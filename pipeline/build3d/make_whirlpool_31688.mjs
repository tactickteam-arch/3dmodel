// Whirlpool 360 Bloomwash Pro H 10 kg 5 star top-load washing machine with in-built heater, model code 31688, Graphite.
// Built to Whirlpool's size, 570 W x 1046 H x 607 D mm (Whirlpool India's product page for 31688 and Sangeetha's listing 21172),
// with the 8.5 kg 31671's builder (buildBloomwash in make_whirlpool_31671.mjs): Whirlpool's photos of the two show the same
// family design (the G-shaped side moulding, the glass lid with its chrome edge, the sloped black panel with the same print),
// so the code is shared and every size below is this model's own, measured off Whirlpool's 31688 photos and scaled to its
// published size (private/research/whirlpool_31688/NOTES.md):
//   front.png              the heights at the front: plinth, cabinet seam, the lid's chrome edge
//   three_quarter_*.jpg    the side moulding, the top cover's shoulders, the feet
//   top_closed.jpg         the control panel (its width and height)
//   lid_open_top.jpg       the well, the drum and the impeller: dark grey dish, black vanes and hub
// Whirlpool shows no rear photo of the 31688, so its back is left plain: no cord, inlet or drain hose are drawn (NOTES.md).
// usage: node make_whirlpool_31688.mjs <entry.json> <tex dir> <out.glb>
import { stateClips, exportGLB, productParts, saveZones } from "./lib.mjs";
import { buildBloomwash } from "./make_whirlpool_31671.mjs";

// ── the 31688's measurements (metres). VERIFIED: W, H, D. Everything else ESTIMATED off Whirlpool's 31688 photos. ──
export const K31688 = {
  rootName: "Whirlpool31688",
  W: 0.57, H: 1.046, D: 0.607,
  // Graphite: neutral dark grey in every Whirlpool photo of it (sRGB 47-68 under studio light); plinth and well a shade darker
  bodyHex: 0x363638, plinthHex: 0x2a2a2c, innerHex: 0x2b2c2e,
  lidOpacity: 0.97,                // top_closed.jpg: the glass reads near black from above, the drum only faintly; at 0.9 it showed through
  footR: 0.017, footH: 0.02, feetX: 0.247, feetXf: [0.045, 0.562],
  // front.png at 0.906 mm/px: the plinth band from 20 to 35 mm, its front cut-away 416 mm wide and 5 mm high
  plinthTop: 0.035, notchTop: 0.025, notch: 0.208,
  cornerR: 0.012,
  // front.png, the camera level with the machine (heights at the front, 0.918 mm/px): the seam at 780 mm, the top cover's grey
  // front wall 781-836 mm, the lid's black front lip 837-872 mm and its chrome top edge to 878 mm, the panel's lower edge 962 mm
  seam: [0.78, 0.853],             // rising to the back as on the 8.5 kg (no rear or side photo of the 31688)
  seat0: 0.8457, lidSlope: 0.1854, // the lid's top at 878 mm at the front; its back edge meets the panel's lower edge
  lidThick: 0.03, shoulder: 0.016,
  lid0: 0.0126, lid1: 0.4656, lidBorder: [0.05, 0.035, 0.03],
  housing0: 0.4656,
  // the panel face: 538 x 145 mm (top_closed.jpg at its true aspect), from 962 mm up to its top at 1046 mm: 35.2 degrees
  face: [[0.4691, 0.962], [0.5876, 1.0455]], faceW: 0.538,
  housingBack: [[0.5945, 1.046], [0.603, 1.0425], [0.607, 1.033]],
  capY: 0.9896, capXf: 0.5364,
  well: { x: 0.2385, f0: 0.042, f1: 0.4556, r: 0.09 },
  drumXf: 0.2505, ringR: 0.214, ringY: 0.7907, drumR: 0.209, drumDepth: 0.45, impR: 0.177,
  hingeX: 0.245,
  sideH: 0.744,
  label: { w: 0.09, h: 0.166, x: 0.18, y: 0.62 },
  back: false,                     // no rear photo: no back texture, cord, inlet or hose
  vaneHex: 0x1c1d1f, hubHex: 0x1c1d1f,   // lid_open_top.jpg: black vanes and hub (median 22-40)
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [PRODUCTS, TEX, OUT] = process.argv.slice(2);
  const ID = "whirlpool-31688";
  const T = `${TEX}/whirlpool_31688`;
  const root = buildBloomwash(K31688);
  const parts = productParts(PRODUCTS, ID);
  const clips = stateClips(root, parts);
  saveZones(PRODUCTS, ID, root, parts);
  await exportGLB(root, clips, OUT, {
    SideL: `${T}/side.jpg`, SideR: `${T}/side.jpg`, PanelFace: `${T}/panel.jpg`, LabelBEE: `${T}/label.png`,
    SteelDrum: `${T}/drum.jpg`, Impeller: `${T}/impeller.jpg`,
  }, { dir: `${TEX}/grain`, materials: {
    // Grain (BENCHMARK.md section 10). Whirlpool names the finish Graphite, a paint colour (no hairline in any of its photos):
    // the cabinet, its sides and the top cover get the soft peel; the moulded plinth and the lid's inner frame the strong peel;
    // nothing on the glass lid, the panel glass or the label.
    Body: { type: "peel_soft" }, SideL: { type: "peel_soft" }, SideR: { type: "peel_soft" }, TopCover: { type: "peel_soft" },
    Plinth: { type: "peel_strong" }, LidFrame: { type: "peel_strong" },
  } });
}
