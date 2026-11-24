// Godrej Eon Valor WTEON VAL 80 5.0 FDAN MTBK, 8 kg top-load washing machine, Metallic Black.
// Built to Godrej's size for this model, 542 W x 976 H x 565 D mm (its page: "Net Dimensions (W*D*H) mm 542*565*976";
// Sangeetha's listing 21610 gives the same 54.2 x 56.5 x 97.6 cm), and to Godrej's own gallery for this model: the straight
// front and back photos give the heights and widths (2.27 px/mm), the panel photo gives the control panel (this model's 8.0 kg
// print), the 3/4 photos the side pressings and the handle recesses, the lid-open photos the lid, the well, the drum, the
// pulsator, the Magic Lint Filter and the detergent box. Godrej gives no side view or drawing, so the depth profile (the console's
// slope, the lid's thickness) is read off the 3/4 photos and fitted to the 565 mm: ESTIMATED (private/research/godrej_val80/NOTES.md).
// The category's reference is make_samsung_wa70.mjs; the helpers are copied from make_lg_t12.mjs.
// usage: node make_godrej_val80.mjs <entry.json> <tex dir> <out.glb>
import { THREE, mat, mesh, box, group, flipV, inward, stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { mergeVertices, mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { uvDecals } from "./decal_curved.mjs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import fs from "node:fs";

const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
const ID = "godrej-wteon-val-80-5-0-fdan-mtbk";
const T = `${TEX}/godrej_val80`;

// ── size (metres); z runs front (+) to back (-), xf is the distance from the front edge ──
const W = 0.542, H = 0.976, D = 0.565;
const zF = D / 2, zB = -D / 2;
const xz = (xf) => zF - xf;
const CB = 0.052;                   // the cabinet's lower edge (front photo: 52 mm at the middle); the plinth and feet below it
const PL0 = 0.030;                  // the recessed plinth's underside
const J = 0.824;                    // the cabinet's top edge, where the top cover sits on it (front photo row 766; side seam)
const TC = 0.893;                   // the top cover's top, round the lid (front photo row 610)
const DECK = 0.858;                 // the well's floor round the tub ring (photo 5: a few cm under the opening)
// the console: 529 mm wide (front photo), its face rising from just behind the lid at 28 degrees to the 976 mm top
const CW = 0.529, CF = 0.400, CY0 = 0.902, CT = 0.530, CY1 = 0.9715;
const SLOPE = Math.atan2(CY1 - CY0, CT - CF), CS = Math.cos(SLOPE), SN = Math.sin(SLOPE);
const SLEN = Math.hypot(CY1 - CY0, CT - CF);
// the glass on it: 505 x 110 mm (the panel photo, scaled by the console's 529 mm), its top edge 6 mm under the console's
const GW = 0.505, GH = 0.110, G1 = SLEN - 0.0064, G0 = G1 - GH;
const OPEN = { x: 0.232, f0: 0.04, f1: 0.385, r: 0.035 };   // the opening under the lid (photo 5)
const drumR = 0.195, RC = 0.2125, zc = xz(RC);              // drum: 8 kg, its centre under the opening's centre
const RH = 0.168, RL = 0.152;                               // the tub ring: its outer edge in the deck, its lip
const drumTop = DECK - 0.026, drumFloor = 0.42, drumDepth = drumTop - drumFloor;
const PIV = [0.899, 0.393];                                 // the lid's hinge axis: height, distance from the front
const LX = 0.264;                                           // the lid's half-width (front photo: 531 mm across the lid)

// ── materials ──
// Metallic Black: Godrej's photos read sRGB 62-75 on the lit front, 45-50 on the side; a dark metallic paint
const bodyM = mat("Body", 0x3e3f42, { metal: 0.45, rough: 0.45 });
const sideM = mat("SideDecal", 0xffffff, { metal: 0.45, rough: 0.45 });
const coverM = mat("TopCover", 0x37383b, { metal: 0.45, rough: 0.4 });
const shellM = mat("ConsoleShell", 0x1d1e20, { metal: 0.4, rough: 0.4 });
const stripM = mat("ConsoleStrip", 0x343537, { metal: 0.3, rough: 0.45 });
const plinthM = mat("Plinth", 0x1b1b1d, { rough: 0.75 });
const footM = mat("Foot", 0x151516, { rough: 0.8 });
const backM = mat("BackPanel", 0xffffff, { rough: 0.6, metal: 0.2 });
const backTopM = mat("BackTop", 0xffffff, { rough: 0.6, metal: 0.2 });
const glassPanelM = mat("PanelGlass", 0x060607, { rough: 0.06 });
// the glass's edge: 4.5 mm thick, a pale blue band all round it (Godrej's 3/4 and front photos: sRGB about 145, 170, 195)
const edgeM = mat("PanelEdge", 0x91aac3, { rough: 0.2, metal: 0.3 });
const GZ = 0.0045;
const btnSideM = mat("ButtonSide", 0x2e2e30, { rough: 0.35 });
const chromeM = mat("Chrome", 0xc9cbce, { metal: 0.9, rough: 0.22 });
// the lid: tinted toughened glass (Godrej's lid-open photo shows the room through it, grey) under a clear coat; a black
// moulded handle along its front; a black print band on the glass behind the handle with three clear lines in it
const lidGlassM = mat("LidGlass", 0x16181b, { rough: 0.06, metal: 0.2, opacity: 0.78, side: THREE.DoubleSide });
const handleM = mat("LidHandle", 0x141416, { rough: 0.32, metal: 0.2 });
const inkM = mat("LidInk", 0x0b0b0c, { rough: 0.3 });
const hingeM = mat("Hinge", 0x1a1a1c, { rough: 0.45 });
const wellM = mat("WellGrey", 0x1d1e20, { rough: 0.5, side: THREE.DoubleSide });
const ringM = mat("TubRing", 0xd8d9db, { rough: 0.4, side: THREE.DoubleSide });
const drumM = mat("SteelDrum", 0xffffff, { rough: 0.32, metal: 0.55, side: THREE.DoubleSide });
const pulsM = mat("Pulsator", 0xcfd0d3, { rough: 0.4, metal: 0.3 });
const capM = mat("PulsatorCap", 0xa9a8de, { rough: 0.35 });
const filterM = mat("LintFilter", 0xffffff, { rough: 0.4 });
const housingM = mat("FilterHousing", 0xe4e5e7, { rough: 0.45 });
const detBoxM = mat("DetergentBox", 0x0d0d0e, { rough: 0.35 });
const detTopM = mat("DetergentLid", 0xffffff, { rough: 0.3 });
const cordM = mat("Cord", 0x161617, { rough: 0.6 });
const plugM = mat("Plug", 0x161617, { rough: 0.5 });
const inletM = mat("Inlet", 0x2a2a2c, { rough: 0.5 });
const outletM = mat("Outlet", 0xe9e9ea, { rough: 0.45 });

const cyl = (name, rt, rb, h, m, x, y, z, seg = 24) => mesh(name, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);

// A plan shape stood up between two surfaces (make_lg_t12.mjs's prism): the shape (x, xf - zF) is extruded upward, then every
// vertex is lifted to its place between bot(x, xf) and top(x, xf). caps picks the caps to keep.
function prism(name, shape, bot, top, material, { bev = 0, caps = ["top", "bottom"], curve = 8, segs = 2 } = {}) {
  const t0 = 0.02;
  const g0 = new THREE.ExtrudeGeometry(shape, { depth: t0, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelOffset: -bev, bevelSegments: segs, curveSegments: curve });
  const pos = g0.attributes.position, nor = g0.attributes.normal, uv = g0.attributes.uv;
  const P = [], N = [], U = [];
  for (const gr of g0.groups) for (let i = gr.start; i < gr.start + gr.count; i += 3) {
    if (gr.materialIndex === 0) {
      const zc0 = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
      if (!caps.includes(zc0 > t0 / 2 ? "top" : "bottom")) continue;
    }
    for (let k = i; k < i + 3; k++) {
      const X = pos.getX(k), Y = pos.getY(k), Z = pos.getZ(k);
      const xf = zF + Y, f = (Z + bev) / (t0 + 2 * bev);
      const yb = bot(X, xf), yt = top(X, xf);
      P.push(X, yb + f * (yt - yb), -Y);
      N.push(nor.getX(k), nor.getZ(k), -nor.getY(k));
      U.push(uv.getX(k), uv.getY(k));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  return mesh(name, mergeVertices(g, 1e-6), material);
}
const flat = (h) => () => h;

// a side profile (points [xf, y]) extruded across a width w, centred on x = 0
function sideSlab(name, pts, w, material) {
  const sh = new THREE.Shape();
  pts.forEach(([xf, y], i) => (i ? sh.lineTo(xf, y) : sh.moveTo(xf, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 6 });
  g.rotateY(Math.PI / 2);
  g.translate(-w / 2, 0, zF);
  return mesh(name, mergeVertices(g, 1e-6), material);
}

// a rounded rectangle seen from above, in shape coordinates (x, xf - zF), front corners rf, back corners rb
function roundRect(p, x0, x1, f0, f1, rf, rb) {
  const Y0 = f0 - zF, Y1 = f1 - zF;
  p.moveTo(x0 + rf, Y0);
  p.lineTo(x1 - rf, Y0); if (rf) p.absarc(x1 - rf, Y0 + rf, rf, -Math.PI / 2, 0, false);
  p.lineTo(x1, Y1 - rb); if (rb) p.absarc(x1 - rb, Y1 - rb, rb, 0, Math.PI / 2, false);
  p.lineTo(x0 + rb, Y1); if (rb) p.absarc(x0 + rb, Y1 - rb, rb, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, Y0 + rf); if (rf) p.absarc(x0 + rf, Y0 + rf, rf, Math.PI, 1.5 * Math.PI, false);
  return p;
}

const root = group("GodrejEonValor");
const cab = group("Cabinet");
root.add(cab);

// ── base: four levelling feet and the recessed black plinth (front photo: feet 42 mm across at x ±237 mm; back photo ±240) ──
cab.add(prism("Plinth", roundRect(new THREE.Shape(), -W / 2 + 0.012, W / 2 - 0.012, 0.012, D - 0.012, 0.015, 0.006), flat(PL0), flat(CB + 0.002), plinthM, { caps: ["bottom"] }));
for (const sx of [-1, 1]) for (const xf of [0.032, D - 0.032]) {
  cab.add(cyl("Foot", 0.019, 0.021, PL0, footM, sx * 0.238, PL0 / 2, xz(xf), 20));
}

// ── cabinet: Metallic Black, rounded upright corners (r 22 mm at the front, 8 mm at the back: the 3/4 photos) ──
cab.add(prism("CabinetBody", roundRect(new THREE.Shape(), -W / 2, W / 2, 0, D, 0.022, 0.008), flat(CB), flat(J), bodyM, { caps: ["bottom"], curve: 10 }));
// the sides: Godrej's 3/4 photo of the right side, straightened (tex_godrej_val80.py side()): the curved pressings and the
// handle recess. The left side is the same pressing turned round (the left recess is toward the front, the right one toward the
// back: Godrej's two 3/4 photos and the back photo), so the same picture serves both, each seen from outside.
for (const sx of [-1, 1]) {
  const L = D - 0.022 - 0.008;
  const p = mesh("SideDecal", flipV(new THREE.PlaneGeometry(L, J - CB - 0.0045)), sideM, sx * (W / 2 + 0.0006), (J + CB - 0.0025) / 2, xz(0.022 + L / 2));
  p.rotation.y = (sx * Math.PI) / 2;
  cab.add(p);
}
// the back: Godrej's rear photo, straightened, the cord and plug painted out (they are modelled below)
{
  const p = mesh("BackDecal", flipV(new THREE.PlaneGeometry(0.538, TC - 0.045)), backM, 0, (TC + 0.045) / 2, zB - 0.0019);
  p.rotation.y = Math.PI;
  cab.add(p);
  const q = mesh("BackTopDecal", flipV(new THREE.PlaneGeometry(CW - 0.012, 0.968 - TC)), backTopM, 0, (0.968 + TC) / 2, zB - 0.0009);
  q.rotation.y = Math.PI;
  cab.add(q);
}

// ── top cover: from the cabinet's top edge to 893 mm, the opening for the lid in it ──
{
  // 0.5 mm proud of the cabinet all round and 3 mm down over it, as the real cover sits on it (no crack at the seam)
  const s = roundRect(new THREE.Shape(), -W / 2 - 0.0005, W / 2 + 0.0005, -0.0005, D + 0.0005, 0.0225, 0.0085);
  s.holes.push(roundRect(new THREE.Path(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r));
  cab.add(prism("TopCover", s, flat(J - 0.003), flat(TC), coverM, { caps: ["top"], curve: 10 }));
}

// ── the console: the slab behind the lid, its sloped face with the panel glass, the print and the keys ──
const printMats = {};
let printTex = {};
{
  const prof = [[CF, TC], [CF, CY0], [CT, CY1], [CT + 0.004, CY1 + 0.0035], [CT + 0.008, H], [D - 0.008, H], [D - 0.002, H - 0.004], [D, H - 0.010], [D, TC]];
  cab.add(sideSlab("Console", prof, CW, shellM));
  // the panel's frame: x across, s up the slope from its foot, h out of it
  const onPanel = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, SN, -CS), new THREE.Vector3(0, CS, SN)).setPosition(0, CY0, xz(CF));
  // the grey strip under the glass (the panel photo: 33 mm on the slope, sRGB 76)
  const st = new THREE.PlaneGeometry(GW, G0 - 0.003);
  st.translate(0, (G0 - 0.003) / 2 + 0.0015, 0.0005);
  cab.add(mesh("ConsoleStrip", st.applyMatrix4(onPanel), stripM));
  // the glass: a rounded rectangle (r 11 mm), UVs u across, v down from its top edge (the print's rows)
  const r = 0.011, sh = new THREE.Shape();
  sh.moveTo(-GW / 2 + r, G0); sh.lineTo(GW / 2 - r, G0); sh.absarc(GW / 2 - r, G0 + r, r, -Math.PI / 2, 0, false);
  sh.lineTo(GW / 2, G1 - r); sh.absarc(GW / 2 - r, G1 - r, r, 0, Math.PI / 2, false);
  sh.lineTo(-GW / 2 + r, G1); sh.absarc(-GW / 2 + r, G1 - r, r, Math.PI / 2, Math.PI, false);
  sh.lineTo(-GW / 2, G0 + r); sh.absarc(-GW / 2 + r, G0 + r, r, Math.PI, 1.5 * Math.PI, false);
  const gg = new THREE.ShapeGeometry(sh, 10);
  const pp = gg.attributes.position, uv = gg.attributes.uv;
  for (let i = 0; i < pp.count; i++) uv.setXY(i, (pp.getX(i) + GW / 2) / GW, (G1 - pp.getY(i)) / GH);
  gg.translate(0, 0, GZ);
  // its edge: the outline extruded GZ deep, the side walls only (the caps would lie on the glass and the console)
  {
    const ex = new THREE.ExtrudeGeometry(sh, { depth: GZ, bevelEnabled: false, curveSegments: 10 });
    const side = ex.groups.find((g) => g.materialIndex === 1);
    const e = new THREE.BufferGeometry();
    for (const k of ["position", "normal"]) { const a = ex.attributes[k]; e.setAttribute(k, new THREE.Float32BufferAttribute(a.array.slice(side.start * 3, (side.start + side.count) * 3), 3)); }
    cab.add(mesh("PanelEdge", e.applyMatrix4(onPanel), edgeM));
  }
  const glass = mesh("PanelGlass", gg.applyMatrix4(onPanel), glassPanelM);
  cab.add(glass);
  // the print, drawn again at 12 px/mm (tex_godrej_val80.py), laid on the glass in two pieces 0.9 mm off it
  printTex = uvDecals(glass, `${T}/decals.json`, (n) => (printMats[n] = mat(n, 0xffffff, { rough: 0.06 })), { cell: [0.003, 0.004], clip: true });
  // the five keys: a dark disc raised 2 mm in a chrome ring (the panel photo's shading); each disc's top is printed from the
  // print piece that holds it, so its icon is the same sharp drawing
  const DECALS = JSON.parse(fs.readFileSync(`${T}/decals.json`, "utf8"));
  const KEYS = JSON.parse(fs.readFileSync(`${T}/panel.json`, "utf8")).buttons;
  const tops = {}, sides = [], rings = [];
  for (const [key, { u, v, r: R }] of Object.entries(KEYS)) {
    const x = u / 1000, s = G1 - v / 1000, rr = R / 1000 - 0.0009;
    const gu = (x + GW / 2) / GW;
    const piece = Object.keys(DECALS).find((k) => DECALS[k].rect[0] <= gu - rr / GW && gu + rr / GW <= DECALS[k].rect[2]);
    if (!piece) throw new Error(`key ${key} crosses a print piece's edge`);
    const [u0, v0, u1, v1] = DECALS[piece].rect;
    // the disc's face, its top 2.0 mm above the glass (1.1 mm above the print), printed from the piece that holds it
    const t = new THREE.CircleGeometry(rr, 40);
    t.translate(x, s, GZ + 0.0020);
    const p = t.attributes.position, tu = t.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const U = (p.getX(i) + GW / 2) / GW, Vv = (G1 - p.getY(i)) / GH;
      tu.setXY(i, (U - u0) / (u1 - u0), (Vv - v0) / (v1 - v0));
    }
    (tops[piece] ||= []).push(t.applyMatrix4(onPanel));
    const c = new THREE.CylinderGeometry(rr, rr, 0.0020, 40, 1, true);
    c.rotateX(Math.PI / 2);
    c.translate(x, s, GZ + 0.0010);
    sides.push(c.applyMatrix4(onPanel));
    const ring = new THREE.TorusGeometry(rr + 0.0004, 0.0008, 8, 48);
    ring.scale(1, 1, 1.4);
    ring.translate(x, s, GZ + 0.0010);
    rings.push(ring.applyMatrix4(onPanel));
  }
  for (const [piece, gs] of Object.entries(tops)) cab.add(mesh(`PanelKeys_${piece}`, mergeGeometries(gs), printMats[`Print_${piece}`]));
  cab.add(mesh("KeySides", mergeGeometries(sides), btnSideM));
  cab.add(mesh("KeyRings", mergeGeometries(rings), chromeM));
}

// ── the well: grey walls down to the deck, the light grey tub ring, the stainless steel drum, the pulsator ──
{
  // the deck: the opening less the tub ring's circle (the ring hugs the opening front and back: photo 5)
  const s = roundRect(new THREE.Shape(), -OPEN.x, OPEN.x, OPEN.f0, OPEN.f1, OPEN.r, OPEN.r);
  const h = new THREE.Path(); h.absarc(0, RC - zF, RH, 0, Math.PI * 2, true); s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 16);
  g.rotateX(-Math.PI / 2);                     // shape y (xf - zF) -> world -z, facing up
  cab.add(mesh("Deck", g, wellM, 0, DECK, 0));
  // the tub ring: a light grey collar from the deck's edge down to its lip, then out under itself to the drum's wall
  const ring = new THREE.LatheGeometry([[drumR, -0.026], [RL, -0.024], [RL - 0.002, -0.018], [RL, -0.010], [RH - 0.004, 0.002], [RH, 0.0015]].map(([r, y]) => new THREE.Vector2(r, y)), 96);
  cab.add(mesh("TubRing", ring, ringM, 0, DECK, zc));
  // the drum wall, inward-facing: the perforated steel tile (100 mm), 12 round
  const dg = new THREE.CylinderGeometry(drumR, drumR, drumDepth, 96, 1, true);
  const duv = dg.attributes.uv;
  const uRep = 12, vRep = drumDepth / ((2 * Math.PI * drumR) / uRep);
  for (let i = 0; i < duv.count; i++) duv.setXY(i, duv.getX(i) * uRep, 1 - duv.getY(i) * vRep);
  inward(dg);
  cab.add(mesh("SteelDrum", dg, drumM, 0, drumTop - drumDepth / 2, zc));
  // the drum's floor and the pulsator: a light grey dish with three swept vanes and a lavender centre cap (photo 5)
  const fl = new THREE.CircleGeometry(drumR, 72); fl.rotateX(-Math.PI / 2);
  cab.add(mesh("DrumFloor", fl, pulsM, 0, drumFloor, zc));
  const RP = 0.172;
  const dish = new THREE.LatheGeometry([[0, 0.016], [0.04, 0.0155], [0.11, 0.009], [RP, 0.003], [RP + 0.004, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 72);
  cab.add(mesh("Pulsator", dish, pulsM, 0, drumFloor, zc));
  const vanes = [0, 1, 2].map((k) => {
    // a vane swept from the hub outward, curving against the turn: its plan outline, raised 14 mm at the hub to 5 at the rim
    const pts = [], back = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, r = 0.035 + t * (RP - 0.045), a = t * 1.15;
      const w = 0.012 * (1 - 0.5 * t);
      pts.push(new THREE.Vector2(r * Math.cos(a) - w * Math.sin(a), r * Math.sin(a) + w * Math.cos(a)));
      back.unshift(new THREE.Vector2(r * Math.cos(a) + w * Math.sin(a), r * Math.sin(a) - w * Math.cos(a)));
    }
    const g = new THREE.ExtrudeGeometry(new THREE.Shape([...pts, ...back]), { depth: 0.012, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1 });
    g.rotateX(-Math.PI / 2);
    g.rotateY((k * 2 * Math.PI) / 3);
    g.translate(0, 0.008, 0);
    return g;
  });
  cab.add(mesh("PulsatorVanes", mergeVertices(mergeGeometries(vanes.map((v) => v.toNonIndexed())), 1e-6), pulsM, 0, drumFloor, zc));
  const cc = new THREE.SphereGeometry(0.021, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2); cc.scale(1, 0.55, 1);
  cab.add(mesh("PulsatorCap", cc, capM, 0, drumFloor + 0.015, zc));
  // the Magic Lint Filter: the lavender cartridge in its white housing on the drum wall at the back, under the detergent box
  const fz = zc - drumR + 0.009;
  cab.add(box("FilterHousing", 0.062, 0.16, 0.008, housingM, 0, drumTop - 0.11, fz - 0.002));
  const fb = flipV(new THREE.BoxGeometry(0.05, 0.13, 0.006));
  cab.add(mesh("LintFilter", fb, [housingM, housingM, housingM, housingM, filterM, housingM], 0, drumTop - 0.11, fz + 0.003));
}

// ── the detergent box: a black box on the tub ring at the back of the well, "DETERGENT" printed on its lid (photo 5) ──
{
  const bw = 0.148, bd = 0.032, bh = 0.016, xf = OPEN.f1 - 0.004 - bd / 2;
  cab.add(box("DetergentBox", bw, bh, bd, detBoxM, 0, DECK + bh / 2, xz(xf)));
  const top = mesh("DetergentLid", flipV(new THREE.PlaneGeometry(bw - 0.004, bd - 0.004)), detTopM, 0, DECK + bh + 0.0009, xz(xf));
  top.rotation.x = -Math.PI / 2;
  cab.add(top);
}

// ── lid: hinged at its back edge; tinted toughened glass with a black moulded handle along its front (photos 3, 5, 6) ──
const lid = group("Lid", 0, PIV[0], xz(PIV[1]));
{
  const add = (m) => { m.position.y -= PIV[0]; m.position.z -= xz(PIV[1]); lid.add(m); return m; };
  const G_BOT = 0.8955, G_TOP = 0.9015, LF = 0.004, LB = 0.390;
  // the glass pane, from under the handle to the back edge
  add(box("LidGlass", 2 * LX, G_TOP - G_BOT, LB - 0.04, lidGlassM, 0, (G_TOP + G_BOT) / 2, xz((0.04 + LB) / 2)));
  // the black print on the glass's underside: a 14 mm band behind the handle, three clear lines in a 13 mm band behind it, and
  // a 4 mm border down each side and along the back (Godrej's lid-open photo; ESTIMATED widths)
  const inkY = 0.8945, inkT = 0.0004;
  // the same lines again along the back edge, by the hinge (photo 6)
  const bands = [[0.062, 0.076], [0.0775, 0.080], [0.0815, 0.084], [0.0855, 0.087], [LB - 0.024, LB - 0.0215], [LB - 0.020, LB - 0.0175], [LB - 0.016, LB - 0.0135], [LB - 0.012, LB - 0.004]];
  for (const [f0, f1] of bands) add(box("LidInk", 2 * LX, inkT, f1 - f0, inkM, 0, inkY, xz((f0 + f1) / 2)));
  for (const sx of [-1, 1]) add(box("LidInk", 0.004, inkT, LB - 0.024 - 0.087, inkM, sx * (LX - 0.002), inkY, xz((0.087 + LB - 0.024) / 2)));
  add(box("LidInk", 2 * LX, inkT, 0.004, inkM, 0, inkY, xz(LB - 0.002)));
  // the handle: a black moulding 58 mm deep, its front face 16 mm high, its top falling back to the glass
  const prof = [[LF, 0.8945], [LF, 0.9055], [LF + 0.002, 0.908], [LF + 0.006, 0.909], [0.022, 0.9092], [0.062, 0.9025], [0.062, 0.8945]];
  const hs = sideSlab("LidHandle", prof, 2 * LX, handleM);
  add(hs);
  // the hinge barrels at the back corners
  for (const sx of [-1, 1]) {
    const b = cyl("HingeBarrel", 0.0055, 0.0055, 0.035, hingeM, sx * 0.17, PIV[0], xz(PIV[1]), 16);
    b.rotation.z = Math.PI / 2;
    add(b);
  }
}
root.add(lid);
// the hinge brackets on the cover under the barrels
for (const sx of [-1, 1]) cab.add(box("HingeBracket", 0.03, 0.005, 0.016, hingeM, sx * 0.17, TC + 0.0025 + 0.0008, xz(PIV[1] - 0.002)));

// ── the back: the power cord with its 3-pin plug in the holder, the water inlet, the drain outlet (Godrej's rear photo) ──
{
  const CORD = JSON.parse(fs.readFileSync(`${T}/cord.json`, "utf8"));
  const cp = CORD.cord.map(([x, y]) => new THREE.Vector3(x, y, zB - 0.0055));
  cp.unshift(new THREE.Vector3(cp[0].x - 0.004, cp[0].y + 0.01, zB - 0.003));
  cab.add(mesh("PowerCord", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cp, false, "centripetal"), 120, 0.0045, 8, false), cordM));
  // the plug: a rounded triangle 46 x 54 mm, 24 mm deep, sat in its holder pins inward (the pins don't show)
  const [px, py] = CORD.plug;
  const tri = new THREE.Shape();
  tri.moveTo(-0.019, -0.027); tri.lineTo(0.019, -0.027); tri.quadraticCurveTo(0.024, -0.027, 0.022, -0.02);
  tri.lineTo(0.004, 0.024); tri.quadraticCurveTo(0, 0.029, -0.004, 0.024);
  tri.lineTo(-0.022, -0.02); tri.quadraticCurveTo(-0.024, -0.027, -0.019, -0.027);
  const pg = new THREE.ExtrudeGeometry(tri, { depth: 0.020, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 6 });
  pg.rotateY(Math.PI);
  cab.add(mesh("Plug", pg, plugM, px, py + 0.006, zB - 0.002));
  cab.add(cyl("InletValve", 0.012, 0.012, 0.016, inletM, 0.047, 0.849, zB - 0.008, 24).rotateX(Math.PI / 2));
  cab.add(cyl("HoseOutlet", 0.013, 0.013, 0.02, outletM, -0.045, 0.08, zB - 0.010, 24).rotateX(Math.PI / 2));
}

// ── the lid's swing: the height it reaches, and how far it would pass into the console (must be 0) ──
const parts = productParts(PRODUCTS, ID);
{
  root.updateMatrixWorld(true);
  const pts = [];
  lid.traverse((o) => { if (o.isMesh) { const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrix)); } });
  const deg = parts.find((p) => p.node === "Lid").angle;
  let h = 0, pen = 0;
  for (let s = 0; s <= 1.0001; s += 0.05) {
    const a = (deg * s * Math.PI) / 180;
    for (const v of pts) {
      const y = PIV[0] + v.y * Math.cos(a) - v.z * Math.sin(a), xf = PIV[1] - (v.y * Math.sin(a) + v.z * Math.cos(a));
      h = Math.max(h, y);
      // the console's face: from (CF, CY0) up the slope; its front below CY0 is upright at CF
      const face = xf < CF ? -Infinity : xf < CT ? CY0 + (xf - CF) * Math.tan(SLOPE) : H;
      if (xf > CF && y > TC && y < face) pen = Math.max(pen, Math.min(face - y, xf - CF));
    }
  }
  console.log(`lid open ${deg} deg: ${(h * 1000).toFixed(1)} mm high, ${(pen * 1000).toFixed(1)} mm into the console`);
}

const clips = stateClips(root, parts);
saveZones(PRODUCTS, ID, root, parts);
await exportGLB(root, clips, OUT, {
  SideDecal: `${T}/side.jpg`, BackPanel: `${T}/back.jpg`, BackTop: `${T}/back_top.jpg`, ...printTex, SteelDrum: `${T}/drum.jpg`,
  LintFilter: `${T}/filter.jpg`, DetergentLid: `${T}/detergent.jpg`,
}, { dir: `${TEX}/grain`, materials: {
  // Grain (BENCHMARK.md section 10): the painted Metallic Black body and cover the soft peel; the moulded plinth the strong
  // peel; nothing on the print, the glass or the photo back
  Body: { type: "peel_soft" }, SideDecal: { type: "peel_soft" }, TopCover: { type: "peel_soft" }, ConsoleShell: { type: "peel_soft" },
  Plinth: { type: "peel_strong" },
} });
// a clear coat on the two glasses (exportGLB's coat comes only with a grain, and glass has none): the lid and the panel
{
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(fs.readFileSync(OUT)));
  const ext = doc.getRoot().listExtensionsUsed().find((e) => e.extensionName === "KHR_materials_clearcoat") || doc.createExtension(KHRMaterialsClearcoat);
  const glass = doc.getRoot().listMaterials().filter((m) => ["LidGlass", "PanelGlass"].includes(m.getName()) || m.getName().startsWith("Print_"));
  for (const m of glass) m.setExtension("KHR_materials_clearcoat", ext.createClearcoat().setClearcoatFactor(1).setClearcoatRoughnessFactor(0.05));
  fs.writeFileSync(OUT, await io.writeBinary(doc));
  console.log(`clear coat on ${glass.map((m) => m.getName())}`);
}
