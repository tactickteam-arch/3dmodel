// Godrej RT EONCRYSTAL 280BN RI OB (Eon Crystal, 244 L, 2 star), double door, frost free, Onyx Black toughened-glass
// doors. Godrej sells this code in Onyx Black only (its page has no colour list; the 280B RI IC BK "Ice Black" is another
// model code whose page no longer opens: NOTES.md).
// Built to Godrej's published size, 607 W x 1570 H x 642.4 D mm ("1.57m X 60.70cm X 64.24cm"), and Godrej's own photos
// on this code's page: a straight front, a 3/4 from the left, both doors open and a stocked render. Those photos show the
// taller 310BN body (1.70 m; the same four images are on its page): so the freezer, which the two share, is measured on
// them, and the fridge below it is 130 mm shorter, with one glass shelf fewer (Godrej: 3 shelves here, 4 on the 310BN,
// whose open photo shows 1 freezer + 3 fridge shelves). Every inside size is ESTIMATED (NOTES.md).
// Freezer on top, fridge below, both doors hinged on the right; each door a black toughened-glass panel with fine sparkle
// in an 11 mm dark rim, its outer corners rounded; a grip pocket in each door's free edge (the left); the Godrej script on
// the freezer door; the doors stand 20 mm above the cabinet's top (3/4 photo).
// Inside, as the open-door photo shows it: in the freezer a glass shelf with the Movable Ice Maker on it at the right,
// vent slots and the COOL AIR CONTROL plate with its knob on the back wall; in the fridge the Cool Shower duct with its
// head under the ceiling, the dial, the LED lens and the Deodorizer tag, two glass shelves, the clear cover over the
// 27 litre vegetable tray; two bins on the freezer door and three on the fridge door.
// Godrej publishes no manual (its manual link is 404), rear photo or clearances for this code: the back is plain.
// Moving parts: freezer door, the ice maker (slides out: "Move or even remove the ice maker"), fridge door, and the
// trays (the two glass shelves, the cover and the vegetable tray, with their food).
// usage: node make_godrej_eon280.mjs <entry .json, never products.json> <tex dir> <out.glb>
import fs from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { LGStock } from "./stock_lg.mjs";
import { THREE, mat, mesh, box, faced, group, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "godrej-rt-eoncrystal-280bn-ri-ob";
const T = `${TEX}/godrej_eon280`;

// ── the one colour: Onyx Black. The glass is two layers: the black with its sparkle (the texture's own level is its
// reflectance under metal 1, satin, so the sparkle glints) and a clear coat over it (KHR_materials_clearcoat 1, nearly
// smooth; UsdPreviewSurface clearcoat in the Apple file), so the studio's lights and the room show in it as sharp
// streaks, as in Godrej's photos (REVIEW.md for the numbers). The rim is near-metal and smooth (0.8 / 0.18), so the
// door's outline catches a thin light line, as the chrome-like edge in Godrej's 3/4 photo ──
const FIN = { name: "Onyx Black", code: "RT EONCRYSTAL 280BN RI OB",
  glass: { metal: Number(process.env.G280_GMETAL ?? 1), rough: Number(process.env.G280_GROUGH ?? 0.45),
    coat: [Number(process.env.G280_COATF ?? 1), Number(process.env.G280_COAT ?? 0.05)] },
  side: 0x3a3b3d, top: 0x313234, rim: { color: 0x3e3f42, metal: Number(process.env.G280_RIMM ?? 0.8), rough: Number(process.env.G280_RIMR ?? 0.18) }, grip: 0x1a1b1d };

// ── size (metres) ──
const W = 0.607, H = 1.57, D = 0.6424;                   // Godrej: 60.70 cm x 1.57 m x 64.24 cm
const doorT = 0.060, Dc = D - doorT;                     // the door 60 mm thick (3/4 photo, ESTIMATED)
const zBack = -D / 2, zFront = zBack + Dc;
const cabTop = H - 0.020;                                // the doors stand 20 mm above the cabinet's top (3/4 photo, ESTIMATED)
const wall = 0.045, backT = 0.045;                       // side walls and back (as the Eon Vibe; open photo)
const feet = 0.042, floorTop = 0.111;                    // feet (front photo: 42 mm under the doors); the fridge floor's front edge
// doors (front photo, 0.447 px per mm down, NOTES.md): the fridge door from 42 mm, the gap 14 mm, the freezer door 469 mm
const doorBottom = 0.042, gap = 0.014, yFreezer = 1.101;
const freezerH = H - yFreezer, fridgeH = yFreezer - gap - doorBottom, yDiv = yFreezer - gap / 2;
// heights inside, ESTIMATED from the open-door photo (the freezer at the open photo's own scale above the mullion,
// moved down 130 mm; the fridge at its scale below, one shelf fewer)
const fzTop = 1.474;                                     // the freezer's ceiling (top frame 76 mm)
const fzCeil = 1.067, fzFloor = 1.121;                   // the mullion: fridge ceiling and freezer floor
const fzShelfTop = 1.280;                                // the freezer's glass shelf
const sA = 0.917, sB = 0.724;                            // the two fridge glass shelves
const coverTop = 0.390, vegTop = 0.355, vegBottom = 0.115; // the vegetable tray's clear cover and the tray under it
const headBottom = sA;                                   // the Cool Shower duct's head, from the ceiling to the top shelf
const ductBottom = 0.400;                                // the duct runs down the back wall to just above the cover
// door bins, from each door's bottom edge (open photo, ESTIMATED): the fridge door's bottle bin and two bins above it,
// the freezer door's two bins
const BINS = {
  FridgeDoor: [{ f: 0.308, h: 0.097, d: 0.10 }, { f: 0.663, h: 0.058, d: 0.085 }, { f: 0.863, h: 0.058, d: 0.085, eggs: true }],
  FreezerDoor: [{ f: 0.056, h: 0.06, d: 0.08 }, { f: 0.244, h: 0.065, d: 0.08 }],
};
const linerFace = 0.016;                                 // the door liner's face, behind the door's back edge
const reach = (name) => Math.max(...BINS[name].map((b) => b.d)) + linerFace;
const frontFridge = zFront - reach("FridgeDoor") - 0.01;
const frontFreezer = zFront - reach("FreezerDoor") - 0.01;

// ── materials ──
const flipV = (geo) => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); return geo; };
const frame = mat("Frame", 0x1c1d20, { rough: 0.6 });                     // the black front frame round the openings (open photo)
const sidePaint = mat("SidePaint", FIN.side, { rough: 0.62 });
const topSkin = mat("TopSkin", FIN.top, { rough: 0.7 });
const freezerGlass = mat("FreezerGlass", 0xffffff, { metal: FIN.glass.metal, rough: FIN.glass.rough });
const fridgeGlass = mat("FridgeGlass", 0xffffff, { metal: FIN.glass.metal, rough: FIN.glass.rough });
const doorRim = mat("DoorRim", FIN.rim.color, { rough: FIN.rim.rough, metal: FIN.rim.metal });
const grip = mat("Grip", FIN.grip, { rough: 0.7 });
const logoM = mat("GodrejLogo", 0xffffff, { rough: 0.45, opacity: 0.999 });
const liner = mat("Liner", 0xe3e6e9, { rough: 0.72, emissive: 0x7d8186, emissiveIntensity: 0.55 });
const glass = mat("Glass", 0xcfe3ea, { rough: 0.05, opacity: 0.45 });
const glassEdge = mat("GlassEdge", 0xdfe4e8, { rough: 0.3 });              // the shelves' light front edge (open photo)
const binMat = mat("Bin", 0xcfe0ea, { rough: 0.15, opacity: 0.62 });
const clearLite = mat("ClearLight", 0xdfe7ee, { rough: 0.12, opacity: 0.3, side: THREE.DoubleSide });
const frosted = mat("Frosted", 0xe9eef1, { rough: 0.45, opacity: 0.8 });
const coverM = mat("CoverGrid", 0xffffff, { rough: 0.3, opacity: 0.55 });
const gasket = mat("Gasket", 0x2a2b2e, { rough: 0.85 });
const light = mat("Light", 0xffffff, { emissive: 0xf4f8ff, emissiveIntensity: 1.4 });
const knobM = mat("Knob", 0xf3f5f7, { rough: 0.4 });
const slotM = mat("Slot", 0x4a5058, { rough: 0.7 });
const iceWhite = mat("IceMakerWhite", 0xeef1f4, { rough: 0.4 });
const iceBin = mat("IceBin", 0xb9cbe6, { rough: 0.15, opacity: 0.7 });
const iceCube = mat("IceCube", 0xe3f4ff, { rough: 0.08, opacity: 0.72 });
const backFz = mat("BackFreezer", 0xffffff, { rough: 0.7 }), ductM = mat("DuctFridge", 0xffffff, { rough: 0.7 });
const printIce = mat("PrintIceMaker", 0xffffff, { rough: 0.5, opacity: 0.999 });
const back = mat("Back", 0x2f3033, { rough: 0.8 });                         // the back: plain (no rear photo), dark (ESTIMATED)
const foot = mat("Foot", 0x17181a, { rough: 0.7 });
const hingeM = mat("Hinge", 0x232427, { metal: 0.4, rough: 0.45 });
const plateM = mat("HingePlate", 0xd9dce0, { metal: 0.5, rough: 0.35 });   // the light hinge plates on the mullion (open photo)
const screw = mat("Screw", 0xb8bcc0, { metal: 0.9, rough: 0.3 });

const root = group("GodrejEonCrystal");
const cab = group("Cabinet");
root.add(cab);

// ── cabinet: painted sides and top, a black front frame, white inside ──
const shellH = cabTop - feet, shellMid = feet + shellH / 2, zMid = zBack + Dc / 2;
const topT = cabTop - fzTop;
cab.add(faced("SideLeft", wall, shellH, Dc, [liner, sidePaint, topSkin, frame, frame, back], -W / 2 + wall / 2, shellMid, zMid));
cab.add(faced("SideRight", wall, shellH, Dc, [sidePaint, liner, topSkin, frame, frame, back], W / 2 - wall / 2, shellMid, zMid));
cab.add(faced("Top", W - 2 * wall, topT, Dc, [frame, frame, topSkin, liner, frame, back], 0, cabTop - topT / 2, zMid));
cab.add(faced("Base", W - 2 * wall, floorTop - feet, Dc, [frame, frame, liner, frame, frame, back], 0, feet + (floorTop - feet) / 2, zMid));
const wallH = fzTop - floorTop;
cab.add(faced("BackWall", W - 2 * wall, wallH, backT, [liner, liner, liner, liner, liner, back], 0, floorTop + wallH / 2, zBack + backT / 2));
const zIn = zBack + backT;                               // the inner face of the back wall
cab.add(box("Divider", W - 2 * wall, fzFloor - fzCeil, Dc - backT, liner, 0, (fzCeil + fzFloor) / 2, zIn + (Dc - backT) / 2));
// the top hinge on the cabinet's top at the right front, under the doors' raised top edge (open photo)
cab.add(box("TopHinge", 0.07, 0.014, 0.05, hingeM, W / 2 - 0.05, cabTop + 0.007, zFront - 0.02));
// the mullion's front: the centre hinge at the right, the light hinge plates at both ends (open photo); the gap between the
// shut doors reads dark on Godrej's front (34 of 255), so a dark strip on the mullion's face behind it
cab.add(box("CenterHinge", 0.07, gap - 0.002, 0.03, hingeM, W / 2 - 0.045, yDiv, zFront + 0.006));
cab.add(box("GapShade", W - 2 * wall, gap, 0.003, frame, 0, yDiv, zFront + 0.0015));
for (const sx of [-1, 1]) {
  cab.add(box("HingePlate", 0.05, gap - 0.004, 0.003, plateM, sx * (W / 2 - 0.05), yDiv, zFront + 0.0045));
  for (const dx of [-0.012, 0.012]) {
    const s = mesh("HingeScrew", new THREE.CylinderGeometry(0.0035, 0.0035, 0.002, 10), screw, sx * (W / 2 - 0.05) + dx, yDiv, zFront + 0.0065);
    s.rotation.x = Math.PI / 2; cab.add(s);
  }
}
// feet: four black levelling feet, 42 mm, their middles 36 mm in from the sides (front photo)
for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
  cab.add(mesh("Foot", new THREE.CylinderGeometry(0.0145, 0.017, feet, 18), foot, fx * (W / 2 - 0.036), feet / 2, fz > 0 ? zFront - 0.04 : zBack + 0.045));
}

// ── inside ──
const inW = W - 2 * wall - 0.006;                        // between the side ribs
const xIn = W / 2 - wall;
const zDuct = zIn + 0.012;                               // the front of the raised duct
const rails = (name, yTop, z0, z1) => { for (const sx of [-1, 1]) cab.add(box(name, 0.008, 0.012, z1 - z0, liner, sx * (xIn - 0.004), yTop - 0.012, (z0 + z1) / 2)); };
// the freezer's back wall: one printed face from its floor to its ceiling (vent slots, the COOL AIR CONTROL plate)
cab.add(mesh("FreezerBackPanel", flipV(new THREE.PlaneGeometry(W - 2 * wall, fzTop - fzFloor)), backFz, 0, (fzTop + fzFloor) / 2, zIn + 0.0006));
{ // the COOL AIR CONTROL knob, 34 mm across, 315 mm under the freezer's ceiling, 15 mm right of the middle (open photo)
  const k = mesh("CoolAirKnob", new THREE.CylinderGeometry(0.014, 0.015, 0.014, 24), knobM, 0.015, fzTop - 0.315, zIn + 0.007);
  k.rotation.x = Math.PI / 2; cab.add(k);
  cab.add(box("CoolAirKnobRib", 0.004, 0.022, 0.004, knobM, 0.015, fzTop - 0.315, zIn + 0.015));
}
// the fridge's Cool Shower duct: its head under the ceiling (230 mm wide, two slots), then 187 mm wide down the back wall
cab.add(box("CoolShowerHead", 0.23, fzCeil - headBottom, 0.045, liner, 0, (fzCeil + headBottom) / 2, zIn + 0.0225));
for (const sx of [-1, 1]) cab.add(box("HeadSlot", 0.022, 0.005, 0.002, slotM, sx * 0.03, fzCeil - 0.103, zIn + 0.0455));
cab.add(mesh("CoolShowerDuct", flipV(new THREE.BoxGeometry(0.187, headBottom - ductBottom, 0.012)), [liner, liner, liner, liner, ductM, liner], 0, (headBottom + ductBottom) / 2, zIn + 0.006));
// the LED lens down the duct (Bright LED Prism Lens), 73 mm wide, 666-493 mm up; the dial at 761 mm
cab.add(box("LedLens", 0.073, 0.173, 0.006, light, 0, (0.666 + 0.493) / 2, zDuct + 0.003));
{
  const k = mesh("DuctDial", new THREE.CylinderGeometry(0.012, 0.013, 0.01, 24), knobM, 0, 0.761, zDuct + 0.005);
  k.rotation.x = Math.PI / 2; cab.add(k);
  cab.add(box("DuctDialRib", 0.003, 0.018, 0.003, knobM, 0, 0.761, zDuct + 0.0115));
}
// the rungs on the side walls between the shelves (open photo)
for (const y of [0.965, 0.837, 0.633, 0.533]) rails("SideRung", y, zIn + 0.05, frontFridge - 0.05);

// the parts that come out (FridgeTrays): the two glass shelves, the cover and the vegetable tray, with their food
const trays = group("FridgeTrays");
cab.add(trays);
function glassShelf(name, yTop, z0) {                    // toughened glass with a light front edge
  const z1 = frontFridge, w = inW - 0.01;
  trays.add(box(name, w, 0.006, z1 - 0.006 - z0, glass, 0, yTop - 0.003, (z0 + z1 - 0.006) / 2));
  trays.add(box(name + "Edge", w, 0.008, 0.006, glassEdge, 0, yTop - 0.004, z1 - 0.003));
  rails(name + "Rail", yTop - 0.006, zIn, z1 - 0.01);
}
glassShelf("ShelfA", sA, zIn + 0.047);                   // the top shelf stops at the duct's head
glassShelf("ShelfB", sB, zDuct + 0.002);
// the vegetable tray: one clear drawer, 27 litres (Godrej): 490 x 225 x 245 mm inside (ESTIMATED to that volume); behind it
// the step over the compressor (ESTIMATED: no photo shows the back)
const bbW = 0.50, bbZ1 = frontFridge, bbD = 0.255, bbZ0 = bbZ1 - bbD, bbZ = (bbZ0 + bbZ1) / 2;
cab.add(faced("CompressorStep", inW, 0.3 - floorTop, bbZ0 - 0.012 - zIn, [liner, liner, liner, liner, liner, liner], 0, (0.3 + floorTop) / 2, (zIn + bbZ0 - 0.012) / 2));
{
  const hh = vegTop - vegBottom;
  trays.add(box("FzBoxFloor", bbW, 0.004, bbD, binMat, 0, vegBottom + 0.002, bbZ));
  trays.add(box("FzBoxBack", bbW, hh, 0.004, binMat, 0, vegBottom + hh / 2, bbZ0 + 0.002));
  trays.add(box("FzBoxL", 0.004, hh, bbD, binMat, -bbW / 2 + 0.002, vegBottom + hh / 2, bbZ));
  trays.add(box("FzBoxR", 0.004, hh, bbD, binMat, bbW / 2 - 0.002, vegBottom + hh / 2, bbZ));
  trays.add(box("FzBoxFront", bbW, hh - 0.012, 0.004, clearLite, 0, vegBottom + (hh - 0.012) / 2, bbZ1 - 0.002));
  trays.add(box("FzBoxRim", bbW + 0.008, 0.012, 0.008, frosted, 0, vegTop - 0.006, bbZ1 - 0.002));
}
// the clear cover over it, with its grid of ribs (open photo), the full depth like a shelf: food stands on it
{
  const z0 = zIn + 0.004, z1 = frontFridge, w = inW - 0.01;
  const g = new THREE.BoxGeometry(w, 0.008, z1 - z0);
  const uv = g.attributes.uv, p = g.attributes.position;  // the grid at its real size (128 mm a tile) on the top face
  for (let i = 0; i < uv.count; i++) { uv.setXY(i, p.getX(i) / 0.128, p.getZ(i) / 0.128); }
  trays.add(mesh("VegCover", g, coverM, 0, coverTop - 0.004, (z0 + z1) / 2));
  trays.add(box("VegCoverLip", w, coverTop - vegTop - 0.002, 0.008, frosted, 0, (coverTop + vegTop) / 2, z1 - 0.004));
  rails("CoverRail", coverTop - 0.008, zIn, z1 - 0.01);
}

// ── groceries (stock_lg.mjs, food.mjs): vegetarian South Indian food, eggs, juices, water and soft drinks ──
const stock = LGStock({ T3: `${TEX}/lg_glt3426`, TF: `${TEX}/food`, BR: `${TEX}/brands`, BRT: `${TEX}/brands/small` });
const vegFloor = vegBottom + 0.004;
// the tall things on the vegetable cover (334 mm under the lower shelf), the low ones on the top shelf, the fruit on the
// lower shelf
stock.shelves(trays, {
  zIn1: zIn, inW, inD: frontFridge - zIn, s1: coverTop - 0.0005, s2: sA - 0.0025, s3: sB - 0.0025, fz: vegFloor, fit: true,
  vz0: bbZ0 + 0.02, vk: 0.8 * (bbD - 0.04) / 0.454,
  shelfB: { hw: inW / 2 - 0.03, z0: zDuct + 0.02, z1: frontFridge - 0.015 },
  drawerB: { hw: bbW / 2 - 0.014, z0: bbZ0 + 0.02, z1: bbZ1 - 0.008, y0: vegFloor },
  drawerCeil: coverTop - 0.008 - 0.01 - vegFloor,
});
// The vegetable tray is 25.5 cm deep, so the 34 cm drumsticks lie across it at the back, and the heap is dropped in again
// around them (the Eon Vibe's copy of the Samsung RT40 builder's method; seed 21 is the first that rests every piece)
const kids = (g, name) => g.children.filter((o) => o.name === name);
const wbox = (o) => { o.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(o); };
const _ray = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0), UP = new THREE.Vector3(0, 1, 0);
const meshesOf = (o) => { const m = []; o.traverse((c) => c.isMesh && m.push(c)); return m; };
const pointsOf = (meshes, n = 1000) => meshes.flatMap((m) => {
  const p = m.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / n)), out = [];
  for (let i = 0; i < p.count; i += step) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld));
  return out;
});
const overXZ = (a, b) => a.max.x > b.min.x && a.min.x < b.max.x && a.max.z > b.min.z && a.min.z < b.max.z;
const gpos = (o) => o.parent.getWorldPosition(new THREE.Vector3());
const measure = (o) => { const b = wbox(o), p = gpos(o); b.min.sub(p); b.max.sub(p); return b; };
function dropOnto(o, placed) {
  const floorY = gpos(o).y, b = wbox(o), own = meshesOf(o), hits = [];
  const near = placed.filter((q) => overXZ(q.box, b)), under = near.flatMap((q) => q.meshes);
  for (const p of pointsOf(own)) {
    let d = p.y - floorY, floor = true;
    if (under.length) { _ray.set(p, DOWN); const h = _ray.intersectObjects(under, false)[0]; if (h && h.distance < d) { d = h.distance; floor = false; } }
    hits.push([d, p.x, p.z, floor]);
  }
  for (const q of near) for (const p of q.pts) {
    if (p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z) continue;
    _ray.set(p, UP);
    const h = _ray.intersectObjects(own, false)[0];
    if (h) hits.push([h.distance, p.x, p.z]);
  }
  let drop = Infinity;
  for (const h of hits) drop = Math.min(drop, h[0]);
  const touch = hits.filter((h) => h[0] - drop < 0.004), c = b.getCenter(new THREE.Vector3()), mx = 0.15 * (b.max.x - b.min.x), mz = 0.15 * (b.max.z - b.min.z);
  const xs = touch.map((h) => h[1]), zs = touch.map((h) => h[2]);
  const steady = touch.some((h) => h[3]) || (Math.min(...xs) - mx <= c.x && c.x <= Math.max(...xs) + mx && Math.min(...zs) - mz <= c.z && c.z <= Math.max(...zs) + mz);
  return { drop, steady };
}
function settle(items, { tries = 1, spread = 0, bounds = null, ceil = Infinity, seed = 7 } = {}) {
  let r = seed;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const placed = [], left = [], tipped = [];
  for (const o of items) {
    const x0 = o.position.x, z0 = o.position.z;
    let best = null;
    for (let t = 0; t < tries; t++) {
      o.position.x = x0 + (t ? rnd() * spread : 0);
      o.position.z = z0 + (t ? rnd() * spread : 0);
      if (bounds) {
        const m = measure(o);
        o.position.x += Math.max(0, -bounds.hw - m.min.x) - Math.max(0, m.max.x - bounds.hw);
        o.position.z += Math.max(0, bounds.z0 - m.min.z) - Math.max(0, m.max.z - bounds.z1);
      }
      o.position.y += 1 - measure(o).min.y;
      const { drop, steady } = dropOnto(o, placed);
      o.position.y -= drop;
      const m = measure(o), y = (m.min.y + m.max.y) / 2, fits = m.max.y <= ceil;
      if (!best || (fits && !best.fits) || (fits === best.fits && (steady && !best.steady || steady === best.steady && y < best.y - 0.001)))
        best = { x: o.position.x, y, z: o.position.z, py: o.position.y, steady, fits };
    }
    o.position.set(best.x, best.py, best.z);
    if (!best.fits) { left.push(o.name); o.removeFromParent(); continue; }
    if (!best.steady) tipped.push(o.name);
    const meshes = meshesOf(o);
    o.updateWorldMatrix(true, true);
    placed.push({ box: wbox(o), meshes, pts: pointsOf(meshes) });
  }
  if (left.length) console.warn(`settle: no room for ${left.join(", ")}`);
  if (tipped.length) console.warn(`settle: no steady spot for ${tipped.join(", ")}`);
}
{
  const v = trays.getObjectByName("FreshZoneStock"), drawerB = { hw: bbW / 2 - 0.014, z0: bbZ0 + 0.02, z1: bbZ1 - 0.008 };
  const c = v.getObjectByName("Cauliflower");
  if (c) for (const m of c.children) if (m.isMesh && (m.rotation.x || m.rotation.z)) {
    m.updateMatrix();
    m.geometry = m.geometry.clone().applyMatrix4(m.matrix);
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
  }
  kids(v, "Drumstick").forEach((o, i) => { o.rotation.y += Math.PI / 2; o.position.set(0.02 * (i % 2 ? 1 : -1), 0, drawerB.z0 + 0.02 + i * 0.024); });
  const HEAP = ["Drumstick", "Cabbage", "Cauliflower", "Onion", "Potato", "Brinjal", "Capsicum", "Carrot", "Tomato", "LadiesFinger", "Coriander", "CurryLeaves", "GreenChilli"];
  settle(v.children.slice().sort((a, b) => HEAP.indexOf(a.name) - HEAP.indexOf(b.name)), { tries: Number(process.env.G280_TRIES ?? 30), spread: 0.08, bounds: drawerB, ceil: coverTop - 0.008 - 0.01 - vegFloor, seed: Number(process.env.G280_SEED ?? 21) });
}

// The shelves are 34-36 cm deep (Godrej's 642 mm body): an item whose rows run past a shelf's front (it would meet the
// door bins with the door shut) or into the Cool Shower duct's head over the top shelf is left out, never scaled
{
  // the top shelf's rows start in front of the duct's head (45 mm off the back wall, 230 mm wide)
  trays.getObjectByName("Shelf2Stock").position.z += 0.016;
  const head = wbox(cab.getObjectByName("CoolShowerHead")), out = [];
  for (const g of ["Shelf1Stock", "Shelf2Stock", "Shelf3Stock"].map((n) => trays.getObjectByName(n)).filter(Boolean)) {
    for (const o of g.children.slice()) {
      const b = wbox(o);
      if (b.max.z > frontFridge - 0.005 || b.intersectsBox(head)) { out.push(o.name); o.removeFromParent(); }
    }
  }
  if (out.length) console.warn(`left out (no room on the shelves): ${out.join(", ")}`);
}

// ── freezer: the glass shelf, and the Movable Ice Maker standing on it at the right ──
{
  const z0 = zIn + 0.002, z1 = frontFreezer, w = inW - 0.01;
  cab.add(box("FreezerShelf", w, 0.006, z1 - 0.006 - z0, glass, 0, fzShelfTop - 0.003, (z0 + z1 - 0.006) / 2));
  cab.add(box("FreezerShelfEdge", w, 0.008, 0.006, glassEdge, 0, fzShelfTop - 0.004, z1 - 0.003));
  rails("FreezerShelfRail", fzShelfTop - 0.006, zIn, z1 - 0.01);
}
// the ice maker: 185 mm wide and 140 mm tall, its middle 145 mm right of the centre (open photo, ESTIMATED): two twist
// trays on top behind a white face with their round grips, the blue-tinted ice box under them with "Movable Ice Maker"
const icX = 0.145, icW = 0.185, icH = 0.14, icD = 0.2, icZ1 = frontFreezer - 0.01, icZ0 = icZ1 - icD;
const ice = group("IceMaker", 0, fzShelfTop, 0);
{
  const zc = (icZ0 + icZ1) / 2, upH = 0.065, binH = icH - upH;
  ice.add(box("IceTrayHousing", icW, upH, icD, iceWhite, icX, binH + upH / 2, zc));
  for (const sx of [-1, 1]) {
    const k = mesh("TwistGrip", new THREE.CylinderGeometry(0.024, 0.024, 0.008, 20), iceWhite, icX + sx * 0.045, binH + upH / 2, icZ1 + 0.004);
    k.rotation.x = Math.PI / 2; ice.add(k);
  }
  const bw = icW - 0.006, bd = icD - 0.01, bz = icZ1 - bd / 2;
  ice.add(box("IceBinFloor", bw, 0.004, bd, iceBin, icX, 0.002, bz));
  ice.add(box("IceBinFront", bw, binH - 0.002, 0.004, iceBin, icX, binH / 2, icZ1 - 0.002));
  for (const sx of [-1, 1]) ice.add(box("IceBinSide", 0.004, binH - 0.002, bd, iceBin, icX + sx * (bw / 2 - 0.002), binH / 2, bz));
  ice.add(mesh("PrintIceMaker", flipV(new THREE.PlaneGeometry(0.08, 0.01)), printIce, icX, binH * 0.62, icZ1 + 0.0006));
  const cube = new THREE.BoxGeometry(0.026, 0.022, 0.026);
  for (let i = 0; i < 8; i++) {
    const c = mesh("IceCube", cube, iceCube, icX - 0.05 + (i % 4) * 0.033, 0.016 + Math.floor(i / 4) * 0.018, icZ1 - 0.04 - (i % 3) * 0.04);
    c.rotation.set(0.2 * (i % 3), 0.5 * i, 0.15 * (i % 4));
    ice.add(c);
  }
}
cab.add(ice);
// the freezer's food: the tubs and packs on the glass shelf behind the ice maker, three packs lying on the freezer's floor
stock.freezer(cab, { fit: true, zIn1: zIn, floor: fzShelfTop + 0.0005, top: fzFloor, box: { hw: inW / 2 - 0.03, z0: zIn + 0.02, z1: icZ0 - 0.01 } });

// ── doors: hinged on the right; a dark rim body with its outer corners rounded, the glass panel in it, the gaskets,
// liner and bins inside, a grip pocket in the free edge (the left) ──
const pw = W - 0.002, bw = pw - 0.12;
const inside = (dep) => [-pw / 2 - bw / 2 + 0.004, -pw / 2 + bw / 2 - 0.004, -(linerFace + dep / 2)];
const xHinge = -pw / 2 + bw / 2 - 0.004;
const EGGS = [0, 1, 2, 3, 4, 5].map((i) => xHinge - 0.03 - i * 0.05);   // a row of six from the hinge end (Godrej's stocked render)
// a rectangle x0..x1, y0..y1 with its top corners rounded by rt and its bottom corners by rb
function rr(x0, y0, x1, y1, rt, rb) {
  const s = new THREE.Shape();
  s.moveTo(x0 + rb, y0);
  s.lineTo(x1 - rb, y0); if (rb) s.quadraticCurveTo(x1, y0, x1, y0 + rb);
  s.lineTo(x1, y1 - rt); if (rt) s.quadraticCurveTo(x1, y1, x1 - rt, y1);
  s.lineTo(x0 + rt, y1); if (rt) s.quadraticCurveTo(x0, y1, x0, y1 - rt);
  s.lineTo(x0, y0 + rb); if (rb) s.quadraticCurveTo(x0, y0, x0 + rb, y0);
  return s;
}
const R = 0.030, RIM = 0.011, BEV = 0.004;              // outer corner radius (front photo, 13 px), the rim, its rounded edge
function door(name, y0, h, glassMat, rt, rb) {
  const pivot = group(name, W / 2, y0, zFront);
  // the body: the outline drawn inset by the bevel, so the rounded edge ends exactly on the door's size
  const body = new THREE.ExtrudeGeometry(rr(-pw / 2 + BEV, BEV, pw / 2 - BEV, h - BEV, rt && rt - BEV, rb && rb - BEV),
    { depth: doorT - 2 * BEV, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 3, curveSegments: 6 });
  pivot.add(mesh(name + "Body", body, doorRim, -pw / 2, 0, BEV));
  // the glass inside the rim, its corners following the door's, textured with its own UVs (top of the image at the top)
  const gx0 = -pw / 2 + RIM, gx1 = pw / 2 - RIM, gy0 = RIM, gy1 = h - RIM;
  const gg = new THREE.ShapeGeometry(rr(gx0, gy0, gx1, gy1, rt && rt - 0.008, rb && rb - 0.008), 8);
  { const p = gg.attributes.position, uv = gg.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - gx0) / (gx1 - gx0), (gy1 - p.getY(i)) / (gy1 - gy0)); }
  pivot.add(mesh(name + "Glass", gg, glassMat, -pw / 2, 0, doorT + 0.0006));
  if (name === "FreezerDoor") {
    // the Godrej script, 44 mm wide, centred, its middle 114 mm under the door's top (front photo)
    pivot.add(mesh("GodrejLogoDecal", flipV(new THREE.PlaneGeometry(0.044, 0.044 * 234 / 512)), logoM, -pw / 2, h - 0.114, doorT + 0.0013));
  }
  // grip pocket in the free edge (Godrej's stocked render, the free edges at 0.46 px per mm): the freezer's 240 mm long,
  // ending 32 mm above its bottom; the fridge's 243 mm, from 104 mm under its top; 22 mm across the edge (ESTIMATED).
  // Godrej's stocked and open renders (silver doors) show it as a ribbed light recess; its 3/4 photo of the black doors
  // shows nothing at those heights, so here it is a flush dark matt inset 0.6 mm off the edge, not a groove (ESTIMATED)
  const rh = name === "FreezerDoor" ? 0.240 : 0.243;
  const ry = name === "FreezerDoor" ? 0.032 + rh / 2 : h - 0.104 - rh / 2;
  const pocket = mesh(name + "Grip", new THREE.ShapeGeometry(rr(-0.011, -rh / 2, 0.011, rh / 2, 0.007, 0.007), 4), grip, -pw - 0.0006, ry, doorT * 0.5);
  pocket.rotation.y = -Math.PI / 2;
  pivot.add(pocket);
  // inside: gasket, liner and bins standing on the liner's face
  pivot.add(box(name + "Gasket", pw - 0.018, h - 0.018, 0.008, gasket, -pw / 2, h / 2, -0.004));
  pivot.add(box(name + "Liner", pw - 0.07, h - 0.07, 0.012, liner, -pw / 2, h / 2, -0.01));
  BINS[name].forEach((b, i) => {
    const w = bw, cx = -pw / 2;
    const zc = -linerFace - b.d / 2, zl = -linerFace - b.d;
    pivot.add(box(`${name}Bin${i}Floor`, w, 0.004, b.d, binMat, cx, b.f + 0.002, zc));
    pivot.add(box(`${name}Bin${i}Lip`, w, b.h - 0.004, 0.004, binMat, cx, b.f + (b.h - 0.004) / 2, zl + 0.002));
    for (const sx of [-1, 1]) pivot.add(box(`${name}Bin${i}End`, 0.004, b.h + 0.012, b.d, binMat, cx + sx * (w / 2 - 0.002), b.f + (b.h + 0.012) / 2, zc));
    if (b.eggs) for (const x of EGGS) { const c = mesh("EggCup", new THREE.SphereGeometry(0.02, 12, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), binMat, x, b.f, zc); c.scale.y = 0.7; pivot.add(c); }
  });
  if (name === "FridgeDoor") {
    // the round stop at the top of the free edge, 43 mm under the door's top (stocked render)
    const dot = mesh("EdgeStop", new THREE.CylinderGeometry(0.005, 0.005, 0.003, 12), screw, -pw - 0.0005, h - 0.043, doorT * 0.5);
    dot.rotation.z = Math.PI / 2; pivot.add(dot);
  }
  return pivot;
}
const fridgeDoor = door("FridgeDoor", doorBottom, fridgeH, fridgeGlass, 0, R);
const freezerDoor = door("FreezerDoor", yFreezer, freezerH, freezerGlass, R, 0);
{ // what sits in the door bins, so it swings out with the door
  const F = BINS.FridgeDoor, Z = BINS.FreezerDoor;
  stock.doorFridge(fridgeDoor, { fit: true, eggY: F[2].f, eggX: EGGS, eggDY: 0, eggTurn: Math.PI / 2, jarY: F[1].f, botY: F[0].f, canY: null, deps: { egg: F[2].d, jar: F[1].d, bottle: F[0].d }, inside });
  stock.doorFreezer(freezerDoor, { fit: true, b1: Z[1].f, b2: Z[0].f, dep: Math.min(Z[0].d, Z[1].d), inside });
  // cartons stand a little askew, as packs do (the Eon Vibe found a carton's side seen exactly edge-on through the shut
  // door made a thin line in headless Chrome's software renderer)
  for (const [n, deg] of [["RealMango", 5], ["RealMixedFruit", -5], ["AmulTaaza", 5]]) {
    const o = fridgeDoor.getObjectByName(n);
    if (o) o.rotation.y += (deg * Math.PI) / 180;
  }
}
root.add(fridgeDoor, freezerDoor);

const parts = productParts(PRODUCTS, ID);
const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
// Grain: the soft peel on the painted sides and top. The glass, the prints and the decals have none.
await exportGLB(root, clips, OUT, {
  FreezerGlass: `${T}/door_ob_fz.jpg`,
  FridgeGlass: `${T}/door_ob_fr.jpg`,
  GodrejLogo: `${T}/logo_light.png`,
  BackFreezer: `${T}/back_freezer.png`,
  DuctFridge: `${T}/duct_fridge.png`,
  PrintIceMaker: `${T}/print_icemaker.png`,
  CoverGrid: `${T}/cover_grid.png`,
  ...stock.textures(),
}, { dir: `${TEX}/grain`, materials: {
  SidePaint: { type: "peel_soft" }, TopSkin: { type: "peel_soft" },
} });
// the clear coat on the two glass panels (exportGLB's coat comes only with a grain, and the glass has none)
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === "KHR_materials_clearcoat") || doc.createExtension(KHRMaterialsClearcoat);
  const glass = doc.getRoot().listMaterials().filter((m) => m.getName() === "FreezerGlass" || m.getName() === "FridgeGlass");
  if (glass.length !== 2) throw new Error("glass materials not found");
  for (const m of glass) m.setExtension("KHR_materials_clearcoat", ext.createClearcoat().setClearcoatFactor(FIN.glass.coat[0]).setClearcoatRoughnessFactor(FIN.glass.coat[1]));
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`clear coat ${FIN.glass.coat} on ${glass.map((m) => m.getName())}`);
}
