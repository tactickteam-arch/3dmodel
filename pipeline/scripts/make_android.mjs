// The files Google's Scene Viewer opens on Android when the browser has no WebXR AR (in-app browsers, Samsung
// Internet, phones without WebXR). Scene Viewer gets one file address and nothing else, so the page can't pick a
// colour or open a door in it: each colour gets its own small .gltf, in that colour, closed, kept to Google's file
// requirements (https://developers.google.com/ar/develop/scene-viewer, "File requirements for models"):
//   - that colour's KHR_materials_variants mapping baked into the meshes; no variants extension, no other colours;
//   - one animation, Rest, the closed pose (Scene Viewer plays only the first; its validator allows 1);
//   - one UV set per mesh (Google's hard limit). The surface grain sits on a second set over the printed pictures on
//     the first, so here it goes and each material keeps the grain map's average roughness and metalness;
//   - pictures no larger than 2048 x 2048 (Google's limit), which also keeps a budget phone's memory low;
//   - geometry, size, nodes, clear coat and glow exactly as in the product's GLB: they are the GLB's own bytes.
// Layout: models/android/<id>/<colour>.gltf (androidFile in site.js). Its one buffer is the product's GLB itself
// (../../<id>.glb), read as plain bytes, so the geometry and the pictures up to 2048 px are not stored
// twice. Only pictures larger than that are added, shrunk, beside it as <hash>.jpg|png. A colour costs tens of kB.
// Each .gltf records the GLB it was made from (extras.android.from, its SHA-1, and the buffer's byteLength), so the
// gate (check_android.mjs) fails a product whose GLB was rebuilt without these. Anything else in the folder is removed.
// usage: node pipeline/scripts/make_android.mjs <id>... | --all  [--entry <entry file>] [--glb <file>]
//   --entry reads the product from that file (a product being built); --glb reads that GLB instead of the entry's
//   (it must be the file that will be served at the entry's glb address)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { androidFile } from "../../site.js";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const req = createRequire(`${SITE}/pipeline/build3d/package.json`);
const { ImageUtils } = await import(req.resolve("@gltf-transform/core"));
export const MAX_TEXTURE = 2048;
const PY = `${SITE}/tools/usdenv/bin/python`; // Pillow, as the Apple-file scripts use
const sha1 = (b) => crypto.createHash("sha1").update(b).digest("hex");

// Pillow: shrink pictures to fit 2048 px, and the average of a picture's channels
function pillow(jobs) {
  if (!jobs.length) return [];
  const code = `
import json, sys
from PIL import Image, ImageStat
out = []
for j in json.load(open(sys.argv[1])):
    im = Image.open(j["in"])
    if j["op"] == "mean":
        out.append([v / 255 for v in ImageStat.Stat(im.convert("RGB")).mean])
        continue
    w, h = im.size
    s = j["max"] / max(w, h)
    im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    if j["fmt"] == "JPEG":
        im.convert("RGB").save(j["out"], "JPEG", quality=90, optimize=True)
    else:
        im.save(j["out"], "PNG", optimize=True)
    out.append(None)
json.dump(out, open(sys.argv[2], "w"))
`;
  fs.mkdirSync(`${SITE}/.work`, { recursive: true });
  const dir = fs.mkdtempSync(path.join(SITE, ".work", "android-"));
  try {
    jobs.forEach((j, i) => { j.in = path.join(dir, `in${i}`); fs.writeFileSync(j.in, j.bytes); delete j.bytes; if (j.op === "shrink") j.out = path.join(dir, `out${i}`); });
    fs.writeFileSync(`${dir}/jobs.json`, JSON.stringify(jobs));
    const r = spawnSync(PY, ["-I", "-c", code, `${dir}/jobs.json`, `${dir}/out.json`], { encoding: "utf8" });
    if (r.status) throw new Error(`Pillow failed: ${(r.stderr || "").trim().split("\n").pop()}`);
    const res = JSON.parse(fs.readFileSync(`${dir}/out.json`, "utf8"));
    return jobs.map((j, i) => (j.op === "shrink" ? fs.readFileSync(j.out) : res[i]));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// a GLB's JSON and where its binary chunk starts in the file
export function readGLB(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
  const len0 = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + len0).toString("utf8"));
  const binStart = 28 + len0, binLen = bytes.length > 20 + len0 ? bytes.readUInt32LE(20 + len0) : 0;
  return { json, binStart, binLen };
}
// every texture reference inside a material ({index, texCoord?} under a key ending in "Texture"), with its holder
export function textureRefs(o, out = []) {
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === "object" && !Array.isArray(v) && Number.isInteger(v.index) && /Texture$/.test(k)) out.push({ holder: o, key: k, ref: v });
    else textureRefs(v, out);
  }
  return out;
}
export const sniff = (b) => (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? "image/png" : b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : null);
const MATERIAL_EXTENSIONS = /^KHR_materials_|^KHR_texture_transform$/;

// the files for one product; returns what it wrote
export function makeAndroid(entry, glbFile = path.join(SITE, entry.glb.replace(/^\//, ""))) {
  const bytes = fs.readFileSync(glbFile), from = sha1(bytes);
  const { json: g, binStart, binLen } = readGLB(bytes);
  if ((g.buffers || []).length !== 1 || g.buffers[0].uri) throw new Error(`${entry.id}: expected one buffer, inside the GLB`);
  const notes = [];
  const img = (i) => { const v = g.bufferViews[g.images[i].bufferView]; return bytes.subarray(binStart + (v.byteOffset || 0), binStart + (v.byteOffset || 0) + v.byteLength); };
  // a picture's real format from its first bytes: a few GLBs call a PNG image/jpeg, which a strict reader refuses
  for (const [i, im] of (g.images || []).entries()) { const t = sniff(img(i)); if (t && t !== im.mimeType) { notes.push(`picture ${im.name || i} is ${t}, not ${im.mimeType}`); im.mimeType = t; } }

  // each colour's material on each primitive: its variant's mapping, or the primitive's own
  const variantNames = (g.extensions?.KHR_materials_variants?.variants || []).map((v) => v.name);
  if (entry.finishes.length > 1 && !variantNames.length) throw new Error(`${entry.id}: ${entry.finishes.length} colours but the GLB has no KHR_materials_variants`);
  const bad = entry.finishes.filter((f) => variantNames.length && !variantNames.includes(f.variant));
  if (bad.length) throw new Error(`${entry.id}: the GLB has no variant for ${bad.map((f) => `"${f.name}" (${f.variant})`).join(", ")}`);
  if (g.animations?.[0]?.name !== "Rest") throw new Error(`${entry.id}: the first clip is "${g.animations?.[0]?.name}", not Rest`);

  // the means of the grain roughness maps (on the second UV set), for the materials that lose them
  const second = new Set(), first = new Set();
  for (const m of g.materials || []) for (const r of textureRefs(m)) (r.ref.texCoord === 1 ? second : first).add(g.textures[r.ref.index].source);
  const meanIdx = [...second];
  const means = new Map(pillow(meanIdx.map((i) => ({ op: "mean", bytes: img(i) }))).map((v, k) => [meanIdx[k], v]));
  // pictures over 2048 px: shrunk once, shared by the colours that use them
  const sizeOf = (i) => ImageUtils.getSize(new Uint8Array(img(i)), g.images[i].mimeType) || [0, 0];
  const bigIdx = (g.images || []).map((_, i) => i).filter((i) => first.has(i) && Math.max(...sizeOf(i)) > MAX_TEXTURE);
  const shrunk = new Map(pillow(bigIdx.map((i) => ({ op: "shrink", bytes: img(i), max: MAX_TEXTURE, fmt: g.images[i].mimeType === "image/jpeg" ? "JPEG" : "PNG" })))
    .map((b, k) => [bigIdx[k], { uri: `${sha1(b).slice(0, 12)}.${g.images[bigIdx[k]].mimeType === "image/jpeg" ? "jpg" : "png"}`, b }]));

  const rel = androidFile(entry, 0);
  const dir = path.join(SITE, path.dirname(rel).replace(/^\//, ""));
  const glbUri = path.posix.relative(path.posix.dirname(rel), entry.glb); // a plain relative path: the validator warns on a query string
  fs.mkdirSync(dir, { recursive: true });
  const keep = new Set();
  const files = [];
  let dropped = 0;
  entry.finishes.forEach((f, fi) => {
    const j = structuredClone(g);
    const vi = variantNames.indexOf(f.variant);
    // the one buffer is the GLB file itself: views move by where its binary chunk starts
    j.buffers = [{ uri: glbUri, byteLength: bytes.length }];
    for (const v of j.bufferViews) { v.buffer = 0; v.byteOffset = (v.byteOffset || 0) + binStart; }
    // this colour's materials, one UV set, no variants
    for (const p of j.meshes.flatMap((m) => m.primitives)) {
      const map = p.extensions?.KHR_materials_variants?.mappings?.find((x) => x.variants.includes(vi));
      if (map) p.material = map.material;
      if (p.extensions) { delete p.extensions.KHR_materials_variants; if (!Object.keys(p.extensions).length) delete p.extensions; }
      delete p.attributes.TEXCOORD_1;
    }
    delete j.extensions?.KHR_materials_variants;
    if (j.extensions && !Object.keys(j.extensions).length) delete j.extensions;
    // the materials this colour uses, renumbered
    const prims = j.meshes.flatMap((m) => m.primitives);
    const mUsed = [...new Set(prims.map((p) => p.material).filter((x) => x !== undefined))].sort((a, b) => a - b), mNew = new Map(mUsed.map((o, n) => [o, n]));
    j.materials = mUsed.map((o) => j.materials[o]);
    for (const p of prims) if (p.material !== undefined) p.material = mNew.get(p.material);
    // pictures on the second UV set go; a roughness map's average stays in the factors
    for (const m of j.materials) for (const r of textureRefs(m)) {
      if (r.ref.texCoord !== 1) continue;
      if (r.key === "metallicRoughnessTexture") {
        const [, gr, bl] = means.get(g.textures[r.ref.index].source);
        r.holder.roughnessFactor = +((r.holder.roughnessFactor ?? 1) * gr).toFixed(4);
        r.holder.metallicFactor = +((r.holder.metallicFactor ?? 1) * bl).toFixed(4);
      }
      delete r.holder[r.key];
      dropped++;
    }
    // the textures, pictures and samplers left, renumbered
    const refs = textureRefs(j.materials);
    const tUsed = [...new Set(refs.map((r) => r.ref.index))].sort((a, b) => a - b), tNew = new Map(tUsed.map((o, n) => [o, n]));
    j.textures = tUsed.map((o) => j.textures[o]);
    for (const r of refs) r.ref.index = tNew.get(r.ref.index);
    const iUsed = [...new Set(j.textures.map((t) => t.source))].sort((a, b) => a - b), iNew = new Map(iUsed.map((o, n) => [o, n]));
    j.images = iUsed.map((o) => (shrunk.has(o) ? (keep.add(shrunk.get(o).uri), { uri: shrunk.get(o).uri, mimeType: j.images[o].mimeType, name: j.images[o].name }) : j.images[o]));
    for (const t of j.textures) t.source = iNew.get(t.source);
    const sUsed = [...new Set(j.textures.map((t) => t.sampler).filter((x) => x !== undefined))].sort((a, b) => a - b), sNew = new Map(sUsed.map((o, n) => [o, n]));
    j.samplers = sUsed.map((o) => j.samplers[o]);
    for (const t of j.textures) if (t.sampler !== undefined) t.sampler = sNew.get(t.sampler);
    for (const k of ["materials", "textures", "images", "samplers"]) if (!j[k]?.length) delete j[k];
    // Rest alone (Scene Viewer plays the first clip only)
    j.animations = [j.animations[0]];
    // the accessors and buffer views still read (the other clips' and the second UV set's go), renumbered
    const accRefs = [];
    for (const p of prims) { for (const k of Object.keys(p.attributes)) accRefs.push([p.attributes, k]); if (p.indices !== undefined) accRefs.push([p, "indices"]); for (const t of p.targets || []) for (const k of Object.keys(t)) accRefs.push([t, k]); }
    for (const s of j.animations[0].samplers) accRefs.push([s, "input"], [s, "output"]);
    for (const s of j.skins || []) if (s.inverseBindMatrices !== undefined) accRefs.push([s, "inverseBindMatrices"]);
    const aUsed = [...new Set(accRefs.map(([o, k]) => o[k]))].sort((a, b) => a - b), aNew = new Map(aUsed.map((o, n) => [o, n]));
    j.accessors = aUsed.map((o) => j.accessors[o]);
    for (const [o, k] of accRefs) o[k] = aNew.get(o[k]);
    const viewRefs = [];
    for (const a of j.accessors) { if (a.bufferView !== undefined) viewRefs.push([a, "bufferView"]); if (a.sparse) viewRefs.push([a.sparse.indices, "bufferView"], [a.sparse.values, "bufferView"]); }
    for (const im of j.images || []) if (im.bufferView !== undefined) viewRefs.push([im, "bufferView"]);
    const vUsed = [...new Set(viewRefs.map(([o, k]) => o[k]))].sort((a, b) => a - b), vNew = new Map(vUsed.map((o, n) => [o, n]));
    j.bufferViews = vUsed.map((o) => j.bufferViews[o]);
    for (const [o, k] of viewRefs) o[k] = vNew.get(o[k]);
    // extensions: only those still in use
    const used = new Set(JSON.stringify(j.materials || []).match(/"KHR_[A-Za-z_]+"/g)?.map((s) => s.slice(1, -1)) || []);
    j.extensionsUsed = (g.extensionsUsed || []).filter((e) => e !== "KHR_materials_variants" && (!MATERIAL_EXTENSIONS.test(e) || used.has(e)));
    if (!j.extensionsUsed.length) delete j.extensionsUsed;
    j.extensionsRequired = (g.extensionsRequired || []).filter((e) => j.extensionsUsed?.includes(e));
    if (!j.extensionsRequired.length) delete j.extensionsRequired;
    j.asset = { ...g.asset, generator: `${g.asset?.generator || "glTF"}; make_android.mjs` };
    j.extras = { ...(g.extras || {}), android: { from, glb: entry.glb, finish: f.name, variant: f.variant || null, maxTexture: MAX_TEXTURE } };
    const name = path.posix.basename(androidFile(entry, fi));
    const text = JSON.stringify(j);
    fs.writeFileSync(path.join(dir, name), text);
    keep.add(name);
    files.push({ file: path.join(dir, name), size: text.length });
  });
  let added = 0;
  for (const { uri, b } of shrunk.values()) if (keep.has(uri)) { fs.writeFileSync(path.join(dir, uri), b); added += b.length; }
  for (const old of fs.readdirSync(dir)) if (!keep.has(old)) fs.rmSync(path.join(dir, old), { recursive: true, force: true });
  notes.push(`${entry.finishes.length} colour${entry.finishes.length > 1 ? "s" : ""}${variantNames.length ? " baked from the variants" : ""}`,
    `${dropped / entry.finishes.length} grain maps left out per colour`, `${shrunk.size} pictures shrunk to ${MAX_TEXTURE} px`);
  return { dir, files, size: added + files.reduce((a, x) => a + x.size, 0), notes, glbSize: binLen };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const ids = args.filter((a, i) => !a.startsWith("--") && !["--glb", "--entry"].includes(args[i - 1]));
  const catalogue = JSON.parse(fs.readFileSync(opt("--entry") ? path.resolve(opt("--entry")) : `${SITE}/products.json`, "utf8")).products;
  const todo = args.includes("--all") ? catalogue : ids.map((id) => catalogue.find((p) => p.id === id) || (console.error(`no entry for ${id}`), process.exit(2)));
  if (!todo.length) { console.error("usage: node pipeline/scripts/make_android.mjs <id>... | --all [--entry <entry file>] [--glb <file>]"); process.exit(2); }
  let total = 0;
  for (const p of todo) {
    const r = makeAndroid(p, opt("--glb") ? path.resolve(opt("--glb")) : undefined);
    total += r.size;
    console.log(`${(r.size / 1048576).toFixed(2).padStart(6)} MB  ${path.relative(SITE, r.dir)}/  ${r.notes.join("; ")}`);
  }
  console.log(`${(total / 1048576).toFixed(1)} MB added in all`);
}
