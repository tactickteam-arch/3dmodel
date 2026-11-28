// Sticks a product's own BEE star label on its model (Sangeetha, 17 Nov 2026: "stickers not showing"; the units in
// their stores all carry it). The label is a die-cut PNG from tex_bee_label.py; where it goes is in
// pipeline/entries/labels.json:
//   "<id>": { "node": "FridgeDoor", "file": "whirlpool_22439/bee_label.png", "width": 0.09,
//             "cx": 0.5, "top": 0.06 | "cy": 0.43, "finishes": { "<finish name>": "<png>" | null }, "note": "..." }
// node: the part it sits on (it moves with it); width in metres (or wfrac, a share of the part's width); cx, cy: the label's centre as fractions of that
// part's front, from the left and from the top; top: or the label's top edge this far below the part's top.
// finishes: a colour with its own label (another model code), or null for a colour whose label isn't confirmed.
// The label lies 0.7 mm proud of whatever surface is under all four corners, found by casting rays at the front.
// usage: node add_label.mjs <model.glb> <productId> [labels.json]   (a product with no entry is left as it is;
// a product not yet promoted can keep its entry in pipeline/entries/<id>.label.json, the same shape)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsVariants } from "@gltf-transform/extensions";
import * as THREE from "three";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [glb, id, cfgPath = path.join(HERE, "../entries/labels.json")] = process.argv.slice(2);
// a product being built keeps its entry in pipeline/entries/<id>.label.json until it is promoted into labels.json
const own = path.join(HERE, `../entries/${id}.label.json`);
const spec = JSON.parse(fs.readFileSync(cfgPath, "utf8"))[id] ?? (fs.existsSync(own) ? JSON.parse(fs.readFileSync(own, "utf8")) : undefined);
if (!spec) { console.log(id, "no label entry"); process.exit(0); }
const TEX = path.join(HERE, "../tex");
const png = (f) => fs.readFileSync(path.join(TEX, f));
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(glb);
const root = doc.getRoot();
const scene = root.listScenes()[0];
const host = root.listNodes().find((n) => n.getName() === spec.node);
if (!host) throw new Error(`${id}: no node ${spec.node}`);
// a label put on before goes, with its materials and pictures, so running this again never doubles anything
for (const n of host.listChildren()) {
  if (n.getName() !== "BeeLabelDecal") continue;
  for (const p of n.getMesh()?.listPrimitives() || []) {
    const mats = [p.getMaterial(), ...(p.getExtension("KHR_materials_variants")?.listMappings().map((m) => m.getMaterial()) || [])];
    p.dispose();
    for (const m of mats) { m?.getBaseColorTexture()?.dispose(); m?.dispose(); }
  }
  n.getMesh()?.dispose(); n.dispose();
}

const world = (n) => new THREE.Matrix4().fromArray(n.getWorldMatrix());
const toHost = world(host).invert();
// every opaque triangle on the part, in the part's own frame
const tris = [];
host.traverse((n) => {
  const mesh = n.getMesh();
  if (!mesh || n.getName() === "BeeLabelDecal") return;
  const m = toHost.clone().multiply(world(n));
  for (const p of mesh.listPrimitives()) {
    if (p.getMaterial()?.getAlphaMode() === "BLEND") continue;
    const pos = p.getAttribute("POSITION"), idx = p.getIndices();
    const v = (i) => new THREE.Vector3(...pos.getElement(i, [])).applyMatrix4(m);
    const n3 = idx ? idx.getCount() : pos.getCount();
    for (let i = 0; i < n3; i += 3) tris.push([v(idx ? idx.getScalar(i) : i), v(idx ? idx.getScalar(i + 1) : i + 1), v(idx ? idx.getScalar(i + 2) : i + 2)]);
  }
});
// the part's front: the area facing the viewer (+z), so a handle or a back panel doesn't widen it
const front = new THREE.Box3();
const nrm = new THREE.Vector3();
for (const [a, b, c] of tris) {
  nrm.subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  if (nrm.z > 0.7 * nrm.length() && nrm.length() > 1e-6) front.expandByPoint(a).expandByPoint(b).expandByPoint(c);
}
const [pw, ph] = pngSize(png(spec.file));
const w = spec.width ?? spec.wfrac * (front.max.x - front.min.x), h = w * ph / pw;
const x = front.min.x + spec.cx * (front.max.x - front.min.x);
const y = spec.top != null ? front.max.y - spec.top - h / 2 : front.max.y - spec.cy * (front.max.y - front.min.y);
const ray = new THREE.Ray(), hit = new THREE.Vector3();
let z = -Infinity;
for (const [dx, dy] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
  ray.set(new THREE.Vector3(x + dx * w / 2, y + dy * h / 2, front.max.z + 1), new THREE.Vector3(0, 0, -1));
  let best = -Infinity;
  for (const [a, b, c] of tris) if (ray.intersectTriangle(c, b, a, true, hit) || ray.intersectTriangle(a, b, c, true, hit)) best = Math.max(best, hit.z);
  if (best === -Infinity) throw new Error(`${id}: the label's corner (${dx}, ${dy}) is off the ${spec.node}`);
  z = Math.max(z, best);
}
z += 0.0007;

const buf = root.listBuffers()[0];
const acc = (type, arr) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
const x0 = x - w / 2, x1 = x + w / 2, y0 = y - h / 2, y1 = y + h / 2;
const prim = doc.createPrimitive()
  .setAttribute("POSITION", acc("VEC3", new Float32Array([x0, y1, z, x1, y1, z, x0, y0, z, x1, y0, z])))
  .setAttribute("NORMAL", acc("VEC3", new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])))
  .setAttribute("TEXCOORD_0", acc("VEC2", new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])))
  .setIndices(acc("SCALAR", new Uint16Array([0, 2, 1, 1, 2, 3])));
const pics = {};   // one picture per file, shared by the colours that use it
const labelMat = (name, file) => {
  const m = doc.createMaterial(name).setBaseColorFactor([1, 1, 1, 1]).setMetallicFactor(0).setRoughnessFactor(0.5).setAlphaMode("BLEND");
  if (file) m.setBaseColorTexture(pics[file] ||= doc.createTexture(name).setImage(new Uint8Array(png(file))).setMimeType("image/png"));
  if (file) m.getBaseColorTextureInfo().setWrapS(33071).setWrapT(33071); // a die-cut sticker: clamped, no line of its opposite edge round it
  else m.setBaseColorFactor([1, 1, 1, 0]);    // a colour whose label isn't confirmed: nothing shows
  return m;
};
prim.setMaterial(labelMat("LabelBEE", spec.file));
if (spec.finishes) {
  const ext = root.listExtensionsUsed().find((e) => e.extensionName === "KHR_materials_variants") || doc.createExtension(KHRMaterialsVariants);
  const variants = ext.listVariants();
  const list = ext.createMappingList();
  for (const [finish, file] of Object.entries(spec.finishes)) {
    const v = variants.find((x) => x.getName() === finish);
    if (!v) throw new Error(`${id}: no colour ${finish}`);
    list.addMapping(ext.createMapping().setMaterial(labelMat(`LabelBEE_${finish.replace(/\W+/g, "_")}`, file)).addVariant(v));
  }
  // every other colour maps back to the main label: model-viewer keeps the material it has for a colour with no mapping,
  // so picking Versailles Gray after Light Gray kept Light Gray's label (test_arphone, 28 Nov)
  const listed = new Set(Object.keys(spec.finishes));
  const rest = variants.filter((v) => !listed.has(v.getName()));
  if (rest.length) { const m = ext.createMapping().setMaterial(prim.getMaterial()); rest.forEach((v) => m.addVariant(v)); list.addMapping(m); }
  prim.setExtension("KHR_materials_variants", list);
}
host.addChild(doc.createNode("BeeLabelDecal").setMesh(doc.createMesh("BeeLabelDecal").addPrimitive(prim)));
fs.writeFileSync(glb, await io.writeBinary(doc));
console.log(id, `label ${(w * 1000).toFixed(0)} x ${(h * 1000).toFixed(0)} mm on ${spec.node} at (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(4)})`);
