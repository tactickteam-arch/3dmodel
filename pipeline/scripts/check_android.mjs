// The gate's "android-sceneviewer" check (STANDARD.md section 5): what an Android phone without WebXR AR gets. Such
// a phone (an in-app browser, Samsung Internet, a phone without WebXR) opens Google's Scene Viewer with one file
// address: each colour's models/android/<id>/<colour>.gltf (make_android.mjs). This checks every one of them, and the
// link the page opens it with, against Google's requirements for Scene Viewer
// (https://developers.google.com/ar/develop/scene-viewer, "File requirements for models" and the validator table):
//   fresh       made from the product's GLB as it is now (its SHA-1 and size), one file per colour, none left over
//   valid       0 errors in the Khronos glTF validator, read with its resources as Scene Viewer reads it
//   colour      every mesh has the material that colour's variant gives it in the GLB; no variants extension
//   google      extensionsRequired empty or only what Scene Viewer supports; 1 animation, Rest; 1 UV set per mesh;
//               no vertex colours or morph targets; triangles, strips or fans only; at most 254 joints and 4 weights;
//               the file and everything it loads within 15 MB (Google's maximum; over 10 MB is a warning)
//   phone       pictures at most 2048 x 2048 (Google's limit), at most 100,000 triangles (Google's limit), and the
//               pictures' memory once decoded (RGBA with mipmaps) within 160 MB, the most a live product needed
//               (112 MB) with headroom, so a budget phone can hold it
//   size        posed by Rest, as Scene Viewer shows it, every point is where the GLB has it at rest (within 0.1 mm),
//               within 3 mm of the published size (parts that stick out listed in gate.json), standing on y = 0;
//               a wall unit's back at z = 0
//   link        the Scene Viewer link the page builds (sceneViewerIntent in site.js): this colour's file, AR first,
//               resizable=false (real size), enable_vertical_placement for a wall unit and never for a floor one,
//               the title, the link back, and the fallback page
// Extensions the file uses but doesn't require (clear coat, specular, glow strength) are optional by the glTF 2.0
// spec: a viewer that doesn't know them draws the material without them. They are listed, not failed.
// usage: node pipeline/scripts/check_android.mjs [<id> ...|--all] [--entry <entry file>]; exits 1 on any FAIL
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { androidFile, sceneViewerIntent, finishPath } from "../../site.js";
import { sniff } from "./make_android.mjs";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const req = createRequire(`${SITE}/pipeline/build3d/package.json`);
const { NodeIO, ImageUtils } = await import(req.resolve("@gltf-transform/core"));
const { ALL_EXTENSIONS } = await import(req.resolve("@gltf-transform/extensions"));
const validator = req("gltf-validator");
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const sha1 = (b) => crypto.createHash("sha1").update(b).digest("hex");
const MB = (n) => (n / 1048576).toFixed(2);

// Google: "UNSUPPORTED_GLTF_EXTENSION_USED ... KHR_materials_pbrSpecularGlossiness, KHR_materials_unlit, KHR_texture_transform"
export const SV_EXTENSIONS = ["KHR_materials_pbrSpecularGlossiness", "KHR_materials_unlit", "KHR_texture_transform"];
export const LIMITS = { maxBytes: 15 * 1048576, recBytes: 10 * 1048576, texture: 2048, triangles: 100000, joints: 254, textureMemoryMB: 160 };
const ORIGIN = "https://3d.sangeetha.com"; // site-config.js publicOrigin's successor; only the shape of the link is checked

const filePath = (url) => path.join(SITE, url.replace(/^\//, "").replace(/[?#].*$/, ""));
// world positions of every vertex, with the Rest clip's first keys applied (as Scene Viewer shows it) or the nodes' own
function points(doc, { rest = false } = {}) {
  const root = doc.getRoot();
  if (rest) {
    const a = root.listAnimations()[0];
    for (const c of a?.listChannels() || []) {
      const out = c.getSampler().getOutput(), n = c.getTargetNode(), p = c.getTargetPath();
      const k = { translation: 3, rotation: 4, scale: 3 }[p];
      if (!k || !n) continue;
      const v = []; for (let i = 0; i < k; i++) v.push(out.getArray()[i]);
      if (p === "translation") n.setTranslation(v); else if (p === "rotation") n.setRotation(v); else n.setScale(v);
    }
  }
  const pts = [];
  for (const n of root.listNodes()) {
    const mesh = n.getMesh(); if (!mesh) continue;
    const m = n.getWorldMatrix(), name = n.getName();
    for (const pr of mesh.listPrimitives()) {
      const a = pr.getAttribute("POSITION"), v = [0, 0, 0], arr = new Float32Array(a.getCount() * 3);
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v);
        arr[3 * i] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12];
        arr[3 * i + 1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13];
        arr[3 * i + 2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14];
      }
      pts.push({ name, arr });
    }
  }
  return pts;
}

export async function checkAndroid({ entry, cfg = null }) {
  const out = [];
  const rec = (key, ok, detail, warn = false) => out.push({ key, status: ok ? "PASS" : warn ? "WARN" : "FAIL", detail });
  const glbFile = filePath(entry.glb);
  if (!fs.existsSync(glbFile)) { rec("files", false, `no GLB at ${entry.glb}`); return out; }
  const glbBytes = fs.readFileSync(glbFile), glbHash = sha1(glbBytes);
  const wall = entry.placement === "wall";
  if (!cfg) {
    const readJSON = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {});
    const all = readJSON(`${SITE}/pipeline/entries/gate.json`), own = readJSON(`${SITE}/pipeline/entries/${entry.id}.gate.json`);
    cfg = { sticksOut: { ...(all["*"]?.sticksOut || {}), ...(all[entry.id]?.sticksOut || {}), ...(own.sticksOut || {}) } };
  }
  const allowed = Object.keys(cfg.sticksOut || {}).map((k) => new RegExp(`^(${k})$`));

  // the GLB at rest, and each colour's material on each mesh as its variants give it
  const glb = await io.readBinary(new Uint8Array(glbBytes));
  const glbPts = points(glb);
  const glbPrims = glb.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  const expect = (variant) => glbPrims.map((pr) => {
    const ml = pr.getExtension("KHR_materials_variants");
    const m = variant && ml?.listMappings().find((x) => x.listVariants().some((v) => v.getName() === variant));
    return (m ? m.getMaterial() : pr.getMaterial())?.getName() ?? null;
  });
  const S = ["w", "h", "d"].map((k) => parseFloat(String(entry.size[k])) / 100);
  const box = wall ? [[-S[0] / 2, 0, 0], [S[0] / 2, S[1], S[2]]] : [[-S[0] / 2, 0, -S[2] / 2], [S[0] / 2, S[1], S[2] / 2]];

  // fresh: one file per colour, nothing else in the folder but the pictures they load
  const want = entry.finishes.map((_, i) => androidFile(entry, i));
  const dir = path.dirname(filePath(want[0]));
  const loads = new Set(want.map((w) => path.basename(w)));
  const missing = want.filter((w) => !fs.existsSync(filePath(w)));
  if (missing.length) { rec("files", false, `missing ${missing.join(", ")}: run node pipeline/scripts/make_android.mjs ${entry.id}`); return out; }
  const slugs = new Set(want);
  rec("files", slugs.size === want.length, `${want.length} colour file${want.length > 1 ? "s" : ""} in ${path.relative(SITE, dir)}/${slugs.size < want.length ? "; two colours share a file name" : ""}`);

  for (let fi = 0; fi < entry.finishes.length; fi++) {
    const f = entry.finishes[fi], url = want[fi], file = filePath(url), tag = path.basename(url);
    const text = fs.readFileSync(file, "utf8");
    let j; try { j = JSON.parse(text); } catch (e) { rec("valid", false, `${tag}: not JSON (${e.message})`); continue; }
    const a = j.extras?.android || {};
    const buf = j.buffers?.[0] || {};
    const bufFile = buf.uri ? path.resolve(path.dirname(file), decodeURIComponent(buf.uri.replace(/[?#].*$/, ""))) : null;
    const fresh = a.from === glbHash && buf.byteLength === glbBytes.length && bufFile === glbFile && (j.buffers || []).length === 1 && a.finish === f.name && (a.variant || null) === (f.variant || null);
    rec("fresh", fresh, fresh ? `${tag}: made from ${entry.glb} as it is now (${glbHash.slice(0, 12)})` : `${tag}: made from ${a.from?.slice(0, 12) || "?"} (${a.finish || "?"}), the GLB is ${glbHash.slice(0, 12)}${bufFile !== glbFile ? `; its buffer is ${buf.uri}` : ""}: run node pipeline/scripts/make_android.mjs ${entry.id}`);
    if (!fresh) continue;

    // every file it loads, as Scene Viewer fetches them
    const resources = {}, sizes = { [tag]: Buffer.byteLength(text) };
    const load = (uri) => { const p = path.resolve(path.dirname(file), decodeURIComponent(uri.replace(/[?#].*$/, ""))); const b = new Uint8Array(fs.readFileSync(p)); sizes[path.relative(SITE, p)] = b.length; if (path.dirname(p) === dir) loads.add(path.basename(p)); return b; };
    for (const b of j.buffers || []) if (b.uri) resources[b.uri] = load(b.uri);
    for (const im of j.images || []) if (im.uri) resources[im.uri] = load(im.uri);
    // the validator gets its own copies (it may keep or change what it is given)
    const vr = (await validator.validateString(text, { uri: tag, maxIssues: 1000, externalResourceFunction: async (uri) => (resources[uri] ? resources[uri].slice() : load(uri)) })).issues;
    const errs = [...new Set(vr.messages.filter((x) => x.severity === 0).map((x) => `${x.code} at ${x.pointer}`))];
    rec("valid", !vr.numErrors, `${tag}: ${vr.numErrors} errors, ${vr.numWarnings} warnings in the Khronos validator${errs.length ? `: ${errs.slice(0, 3).join("; ")}` : ""}`);
    const total = Object.values(sizes).reduce((s, n) => s + n, 0);

    const doc = await io.readJSON({ json: j, resources });
    const root = doc.getRoot();
    const prims = root.listMeshes().flatMap((m) => m.listPrimitives());

    // colour
    const got = prims.map((pr) => pr.getMaterial()?.getName() ?? null), exp = expect(f.variant);
    const wrong = got.map((g, i) => (g !== exp[i] ? `${g} for ${exp[i]}` : null)).filter(Boolean);
    const leftVariants = !!(j.extensions?.KHR_materials_variants || (j.extensionsUsed || []).includes("KHR_materials_variants"));
    rec("colour", got.length === exp.length && !wrong.length && !leftVariants, `${tag}: ${f.name}${f.variant ? ` (variant "${f.variant}")` : ""}, ${got.length} meshes${got.length !== exp.length ? `, the GLB has ${exp.length}` : ""}${wrong.length ? `; wrong material on ${wrong.length}: ${[...new Set(wrong)].slice(0, 3).join(", ")}` : ""}${leftVariants ? "; still has KHR_materials_variants" : ""}`);

    // google
    const req2 = (j.extensionsRequired || []).filter((e) => !SV_EXTENSIONS.includes(e));
    const optional = (j.extensionsUsed || []).filter((e) => !SV_EXTENSIONS.includes(e));
    const anims = root.listAnimations().map((x) => x.getName());
    let uv2 = 0, colours = 0, morph = 0, badMode = 0, weights = 0, tris = 0;
    for (const pr of prims) {
      const names = pr.listSemantics();
      if (names.some((s) => /^TEXCOORD_[1-9]/.test(s))) uv2++;
      if (names.some((s) => /^COLOR_/.test(s))) colours++;
      if (names.some((s) => /^(JOINTS|WEIGHTS)_[1-9]/.test(s))) weights++;
      if (pr.listTargets().length) morph++;
      const mode = pr.getMode();
      if (![4, 5, 6].includes(mode)) badMode++;
      const n = pr.getIndices()?.getCount() ?? pr.getAttribute("POSITION").getCount();
      tris += mode === 4 ? n / 3 : Math.max(0, n - 2);
    }
    const joints = root.listSkins().reduce((s, k) => s + k.listJoints().length, 0);
    const gp = [];
    if (req2.length) gp.push(`requires ${req2.join(", ")}`);
    if (anims.length !== 1 || anims[0] !== "Rest") gp.push(`${anims.length} animations (${anims.slice(0, 2).join(", ")}): need Rest alone`);
    if (uv2) gp.push(`${uv2} meshes with a second UV set`);
    if (colours) gp.push(`${colours} meshes with vertex colours`);
    if (morph) gp.push(`${morph} meshes with morph targets`);
    if (badMode) gp.push(`${badMode} meshes not triangles`);
    if (weights || joints > LIMITS.joints) gp.push(`${joints} joints, ${weights} meshes with over 4 weights`);
    if (total > LIMITS.maxBytes) gp.push(`${MB(total)} MB to load (Google's maximum 15 MB)`);
    rec("google", !gp.length, `${tag}: ${gp.length ? gp.join("; ") : `nothing required beyond Scene Viewer's list, Rest alone, 1 UV set, triangles only, ${MB(total)} MB to load`}${optional.length ? `; optional (glTF 2.0: may be ignored): ${optional.join(", ")}` : ""}`);
    if (total > LIMITS.recBytes) rec("google", false, `${tag}: ${MB(total)} MB to load, over Google's recommended 10 MB`, true);

    // phone
    let maxTex = 0, mem = 0, bigTex = [];
    for (const t of root.listTextures()) {
      const b = t.getImage().slice(), kind = sniff(b); // a copy: getSize reads from the start of the underlying buffer
      if (kind !== t.getMimeType()) bigTex.push(`${t.getName() || t.getURI()} is ${kind || "neither PNG nor JPEG"} but called ${t.getMimeType()}`);
      const s = (kind && ImageUtils.getSize(b, kind)) || [0, 0];
      maxTex = Math.max(maxTex, s[0], s[1]);
      if (Math.max(s[0], s[1]) > LIMITS.texture) bigTex.push(`${t.getName() || t.getURI()} ${s.join("x")}`);
      mem += (s[0] * s[1] * 4 * 4) / 3;
    }
    const memMB = mem / 1048576;
    rec("phone", !bigTex.length && tris <= LIMITS.triangles && memMB <= LIMITS.textureMemoryMB,
      `${tag}: ${Math.round(tris).toLocaleString("en")} triangles (limit 100,000), ${root.listTextures().length} pictures, largest ${maxTex} px (limit ${LIMITS.texture}), ${memMB.toFixed(0)} MB decoded (budget ${LIMITS.textureMemoryMB}), ${root.listMaterials().length} materials${bigTex.length ? `; wrong: ${bigTex.slice(0, 3).join(", ")}` : ""}`);

    // size: Rest pose = the GLB at rest; the published size; on the floor (or the wall)
    const pts = points(doc, { rest: true });
    let moved = 0, n = 0;
    const body = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]], reach = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]], over = new Map();
    pts.forEach(({ name, arr }, k) => {
      const ref = glbPts[k]?.arr;
      const ok = allowed.some((r) => r.test(name));
      for (let i = 0; i < arr.length; i += 3) {
        n++;
        if (!ref || ref.length !== arr.length || Math.abs(ref[i] - arr[i]) > 1e-4 || Math.abs(ref[i + 1] - arr[i + 1]) > 1e-4 || Math.abs(ref[i + 2] - arr[i + 2]) > 1e-4) moved++;
        const w = [arr[i], arr[i + 1], arr[i + 2]];
        let o = 0; for (let q = 0; q < 3; q++) o = Math.max(o, box[0][q] - w[q], w[q] - box[1][q]);
        if (o > 0.003 && !ok) over.set(name, Math.max(over.get(name) || 0, o));
        for (let q = 0; q < 3; q++) {
          if (!ok) { body[0][q] = Math.min(body[0][q], w[q]); body[1][q] = Math.max(body[1][q], w[q]); }
          const c = Math.min(box[1][q], Math.max(box[0][q], w[q])); reach[0][q] = Math.min(reach[0][q], c); reach[1][q] = Math.max(reach[1][q], c);
        }
      }
    });
    const short = [0, 1, 2].filter((q) => S[q] - (reach[1][q] - reach[0][q]) > 0.003);
    const floorOk = Math.abs(body[0][1]) <= 0.002, wallOk = !wall || Math.abs(body[0][2]) <= 0.002;
    rec("size", pts.length === glbPts.length && !moved && !over.size && !short.length && floorOk && wallOk,
      `${tag}: ${moved ? `${moved} of ${n} points not where the GLB has them at rest; ` : ""}body ${[0, 1, 2].map((q) => ((body[1][q] - body[0][q]) * 100).toFixed(1)).join(" x ")} cm (published ${S.map((s) => (s * 100).toFixed(1)).join(" x ")}), lowest point ${(body[0][1] * 1000).toFixed(1)} mm` +
      (wall ? `, back at z ${(body[0][2] * 1000).toFixed(1)} mm` : "") +
      (over.size ? `; past the published size: ${[...over].slice(0, 4).map(([k, o]) => `${k} ${(o * 1000).toFixed(0)} mm`).join(", ")}` : "") + (short.length ? `; short in ${short.map((q) => "WHD"[q]).join(", ")}` : ""));

    // link
    const fileUrl = `${ORIGIN}${url}?v=7`, page = `${ORIGIN}${finishPath(entry, fi) || `/p/${entry.id}`}`;
    const intent = sceneViewerIntent(entry, fi, { file: fileUrl, page, fallback: `${page}#no-ar` });
    const m = intent.match(/^intent:\/\/arvr\.google\.com\/scene-viewer\/1\.[0-9]\?([^#]*)#Intent;(.*);end;$/);
    const q = new URLSearchParams(m?.[1] || ""), extras = m?.[2] || "";
    const lp = [];
    if (!m) lp.push("not an intent:// link to arvr.google.com/scene-viewer");
    if (q.get("file") !== fileUrl) lp.push(`file is ${q.get("file")}`);
    if (q.get("mode") !== "ar_preferred") lp.push(`mode ${q.get("mode")}`);
    if (q.get("resizable") !== "false") lp.push("resizable isn't false (real size)");
    if ((q.get("enable_vertical_placement") === "true") !== wall) lp.push(wall ? "no enable_vertical_placement for a wall unit" : "enable_vertical_placement on a floor product");
    if (!q.get("title") || q.get("title").length > 60) lp.push(`title "${q.get("title")}"`);
    if (q.get("link") !== page) lp.push(`link ${q.get("link")}`);
    if (!/(^|;)scheme=https(;|$)/.test(extras) || !/package=com\.google\.android\.googlequicksearchbox/.test(extras) || !/action=android\.intent\.action\.VIEW/.test(extras)) lp.push("not the Google app's https VIEW intent");
    if (!extras.includes(`S.browser_fallback_url=${encodeURIComponent(`${page}#no-ar`)}`)) lp.push("no fallback page");
    rec("link", !lp.length, `${tag}: ${lp.length ? lp.join("; ") : `ar_preferred, resizable=false${wall ? ", enable_vertical_placement=true" : ""}, title "${q.get("title")}", link back, fallback page`}`);
  }
  const extra = fs.readdirSync(dir).filter((x) => !loads.has(x));
  if (extra.length) rec("files", false, `left over in ${path.relative(SITE, dir)}/: ${extra.slice(0, 4).join(", ")}: run node pipeline/scripts/make_android.mjs ${entry.id}`);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const entryArg = args.includes("--entry") ? args[args.indexOf("--entry") + 1] : null;
  const ids = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--entry");
  const products = JSON.parse(fs.readFileSync(entryArg ? path.resolve(entryArg) : `${SITE}/products.json`, "utf8")).products;
  const todo = args.includes("--all") || !ids.length ? products.filter((p) => !p.hidden || entryArg) : ids.map((id) => products.find((p) => p.id === id) || (console.error(`no entry for ${id}`), process.exit(2)));
  let fails = 0, warns = 0, rows = 0;
  for (const p of todo) {
    for (const r of await checkAndroid({ entry: p })) {
      rows++;
      if (r.status === "FAIL") fails++; if (r.status === "WARN") warns++;
      if (r.status !== "PASS" || todo.length <= 3 || process.env.VERBOSE) console.log(`${r.status.padEnd(5)} ${p.id.padEnd(40)} ${r.key.padEnd(6)} ${r.detail}`);
    }
  }
  console.log(`${todo.length} products, ${rows} checks: ${fails} FAIL, ${warns} WARN`);
  process.exit(fails ? 1 : 0);
}
