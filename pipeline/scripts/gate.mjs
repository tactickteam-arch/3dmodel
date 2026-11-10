// The product gate (pipeline/entries/STANDARD.md): every automatic check a product must pass before it goes on show,
// run the same way for every product. It measures the files, then serves a staging catalogue with only this product on
// show and runs the page tests one at a time, then renders the views a person must look at. It writes REPORT.md (PASS,
// FAIL or WAIVED for each check, with the numbers) and REVIEW.md (the pictures to look at), and exits 1 on any FAIL.
// usage: node pipeline/scripts/gate.mjs <id> [out dir, default .work/gate/<id>] [--fast] [--entry <entry file>]
//   --fast skips the page tests and the renders (for quick rounds while building; a product passes only on a full run)
//   --entry gates the entry in that file instead of the one in products.json (a product being rebuilt)
//   GATE_PORT=<n> picks the ports (server n, browsers n+1 to n+12; default 8800), so several gates can run at once
// Waivers and parts that really stick out past the published size: pipeline/entries/gate.json (each with its reason).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const B3D = `${SITE}/pipeline/build3d`, SCR = `${SITE}/pipeline/scripts`;
const req = createRequire(`${B3D}/package.json`);
const { NodeIO } = await import(req.resolve("@gltf-transform/core"));
const { ALL_EXTENSIONS } = await import(req.resolve("@gltf-transform/extensions"));

const args = process.argv.slice(2);
const fast = args.includes("--fast");
const entryArg = args.includes("--entry") ? args[args.indexOf("--entry") + 1] : null;
const [id, outArg] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--entry");
if (!id) { console.error("usage: node pipeline/scripts/gate.mjs <id> [out dir] [--fast] [--entry pipeline/entries/<id>.json]"); process.exit(2); }
const OUT = path.resolve(outArg || `${SITE}/.work/gate/${id}`);
fs.mkdirSync(OUT, { recursive: true });
const PORT = +(process.env.GATE_PORT || 8800);

// ── the entry: --entry <file>, else products.json, else pipeline/entries/<id>.json (a product not yet promoted) ──
const catalogue = JSON.parse(fs.readFileSync(`${SITE}/products.json`, "utf8"));
const fromFile = (f) => JSON.parse(fs.readFileSync(path.resolve(SITE, f), "utf8")).products.find((p) => p.id === id);
let entry = entryArg ? fromFile(entryArg) : catalogue.products.find((p) => p.id === id);
if (!entry && fs.existsSync(`${SITE}/pipeline/entries/${id}.json`)) entry = fromFile(`pipeline/entries/${id}.json`);
if (!entry) { console.error(`no entry for ${id} in products.json or pipeline/entries/${id}.json`); process.exit(2); }
// gate.json holds the parts every product may have sticking out ("*") and each product's own, plus the waivers, which
// only a person writes. A builder lists its product's protruding parts, each with its source, in pipeline/entries/<id>.gate.json
// ({"sticksOut": {...}}); any "waive" there is ignored.
const readJSON = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {});
const cfgAll = readJSON(`${SITE}/pipeline/entries/gate.json`), cfgOwn = readJSON(`${SITE}/pipeline/entries/${id}.gate.json`);
const cfg = { sticksOut: { ...(cfgAll["*"]?.sticksOut || {}), ...(cfgAll[id]?.sticksOut || {}), ...(cfgOwn.sticksOut || {}) }, waive: { ...(cfgAll[id]?.waive || {}) } };

const cat = entry.category, isFridge = cat === "Refrigerator", isWasher = cat === "Washing machine", isAC = cat === "Air conditioner";
const wall = entry.placement === "wall";
// budgets: the products that set the standard (LG 343 L fridge, LG 12 kg and Samsung 7 kg washers, Haier AC) plus headroom
const BUDGET = {
  Refrigerator: { glb: 3.8, usdz: 8.0, meshes: 450, entities: 520 },
  "Washing machine": { glb: 2.5, usdz: 3.5, meshes: 80, entities: 130 },
  "Air conditioner": { glb: 1.2, usdz: 1.5, meshes: 40, entities: 70 },
}[cat];

const results = [];
function record(key, ok, detail, warnOnly = false) {
  const status = ok ? "PASS" : cfg.waive[key] ? "WAIVED" : warnOnly ? "WARN" : "FAIL";
  results.push({ key, status, detail: status === "WAIVED" ? `${detail} (waived: ${cfg.waive[key]})` : detail });
  console.log(`${status.padEnd(6)} ${key.padEnd(14)} ${detail}`);
}
const exists = (p) => p && fs.existsSync(path.join(SITE, p.replace(/^\//, "")));
const file = (p) => path.join(SITE, p.replace(/^\//, ""));
const MB = (n) => (n / 1048576).toFixed(2);
const cm = (s) => parseFloat(String(s)) / 100;
const run = (cmd, argv, opts = {}) => spawnSync(cmd, argv, { cwd: SITE, encoding: "utf8", timeout: opts.timeout || 900000, env: { ...process.env, ...(opts.env || {}) }, maxBuffer: 64 * 1024 * 1024 });
const tail = (s, n = 3) => (s || "").trim().split("\n").slice(-n).join(" | ");

// ── 1. the entry and its files ──
const parts = entry.parts || [];
{
  const need = ["id", "brand", "brandLogo", "category", "model", "name", "shortName", "summary", "arTip", "glb", "thumb", "photos", "placement", "arLabel", "orbit", "finishes", "parts", "size", "sizeNote", "specs", "source", "hotspots"];
  const missing = need.filter((k) => entry[k] === undefined || entry[k] === "" || (Array.isArray(entry[k]) && !entry[k].length));
  record("entry", !missing.length, missing.length ? `missing: ${missing.join(", ")}` : `all ${need.length} fields present`);
  record("specs", (entry.specs || []).length >= 8, `${(entry.specs || []).length} spec rows (at least 8, each from the maker or Sangeetha)`);
  const hs = entry.hotspots || [];
  const badHs = hs.filter((h) => !h.title || !h.text || h.pos?.length !== 3 || h.normal?.length !== 3);
  record("hotspots", hs.length === 4 && !badHs.length, `${hs.length} feature callouts (need 4)${badHs.length ? `, ${badHs.length} incomplete` : ""}`);
  const badParts = parts.filter((p) => !p.key || !p.node || !p.zone?.closed || !p.zone?.open || !(p.axis || p.slide));
  record("parts", parts.length >= 1 && parts.length <= 4 && !badParts.length && parts.some((p) => p.hint), `${parts.length} moving parts (${parts.map((p) => p.key + (p.needs ? `<${p.needs}` : "")).join(" ")})${badParts.length ? `, ${badParts.length} without node, axis or zones` : ""}${parts.some((p) => p.hint) ? "" : ", no hint part"}`);
  record("source", /^https:\/\//.test(entry.source || ""), `maker page: ${entry.source || "none"}`);
  record("sangeetha", !!entry.sangeethaUrl, entry.sangeethaUrl ? "Sangeetha listing linked" : "no Sangeetha listing (fine only if the product isn't in Sangeetha's catalogue)", true);
  if (!wall) record("fit", !!entry.fit, entry.fit ? `clearances: ${Object.keys(entry.fit).join(", ")}` : "no clearances (fine only if the maker publishes none)", true);
  const jpegSize = (f) => { const b = fs.readFileSync(f); for (let i = 2; i < b.length - 9;) { if (b[i] !== 0xff) { i++; continue; } const t = b[i + 1]; if (t >= 0xc0 && t <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(t)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + b.readUInt16BE(i + 2); } return [0, 0]; };
  const photos = entry.photos || [];
  const badPh = photos.filter((p) => !exists(p) || jpegSize(file(p)).join("x") !== "900x900");
  record("photos", photos.length === 4 && !badPh.length, `${photos.length} photos (need 4 at 900x900)${badPh.length ? `; wrong or missing: ${badPh.join(", ")}` : ""}`);
  const files = [entry.glb, entry.thumb, entry.brandLogo, `/banners/${id}.html`, ...(entry.finishes || []).map((f) => f.usdz)];
  const free = wall ? [] : (entry.finishes || []).map((f) => f.usdz.replace(/\.usdz$/, "-free.usdz"));
  const missingF = [...files, ...free].filter((f) => !exists(f));
  record("files", !missingF.length, missingF.length ? `missing: ${missingF.join(", ")}` : `model, photo, logo, Quick Look banner and ${files.length - 4 + free.length} Apple files present`);
}

// ── 2. the GLB: size, real dimensions, where it stands, clips, grain, stock ──
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = exists(entry.glb) ? await io.read(file(entry.glb)) : null;
const glbHashes = new Set();
if (doc) {
  const size = fs.statSync(file(entry.glb)).size;
  record("glb-size", size / 1048576 <= BUDGET.glb, `${MB(size)} MB (budget ${BUDGET.glb} MB)`);
  for (const t of doc.getRoot().listTextures()) glbHashes.add(crypto.createHash("sha1").update(t.getImage()).digest("hex"));

  // every vertex at rest against the published box; parts listed in gate.json "sticksOut" may pass it (cord, plug, hoses...)
  const S = ["w", "h", "d"].map((k) => cm(entry.size[k]));
  const box = wall ? [[-S[0] / 2, 0, 0], [S[0] / 2, S[1], S[2]]] : [[-S[0] / 2, 0, -S[2] / 2], [S[0] / 2, S[1], S[2] / 2]];
  const allowed = Object.keys(cfg.sticksOut).map((k) => new RegExp(`^(${k})$`));
  const mul = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  // reach: how far the product fills the published box. A listed part counts as far as the box (an inlet valve can be what
  // the maker's depth is measured to), so a body that falls short is still caught
  const body = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]], reach = [[1e9, 1e9, 1e9], [-1e9, -1e9, -1e9]], over = new Map(), stockOut = new Map();
  let stockCount = 0;
  const parentOf = new Map();
  for (const n of doc.getRoot().listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
  const tagged = (n) => { for (let c = n; c; c = parentOf.get(c)) if (c.getExtras()?.stock) return true; return false; };
  for (const n of doc.getRoot().listNodes()) {
    if (n.getExtras()?.stock) stockCount++;
    const mesh = n.getMesh(); if (!mesh) continue;
    const m = n.getWorldMatrix(), name = n.getName(), ok = allowed.some((r) => r.test(name)), food = tagged(n);
    for (const pr of mesh.listPrimitives()) {
      const a = pr.getAttribute("POSITION"), v = [0, 0, 0];
      for (let i = 0; i < a.getCount(); i++) {
        a.getElement(i, v); const w = mul(m, v[0], v[1], v[2]);
        let o = 0; for (let k = 0; k < 3; k++) o = Math.max(o, box[0][k] - w[k], w[k] - box[1][k]);
        if (o > 0.003) (food ? stockOut : over).set(name, Math.max((food ? stockOut : over).get(name) || 0, o));
        if (!ok) for (let k = 0; k < 3; k++) { body[0][k] = Math.min(body[0][k], w[k]); body[1][k] = Math.max(body[1][k], w[k]); }
        if (!food) for (let k = 0; k < 3; k++) { const c = Math.min(box[1][k], Math.max(box[0][k], w[k])); reach[0][k] = Math.min(reach[0][k], c); reach[1][k] = Math.max(reach[1][k], c); }
      }
    }
  }
  const bad = [...over].filter(([name]) => !allowed.some((r) => r.test(name))).sort((a, b) => b[1] - a[1]);
  const dims = [0, 1, 2].map((k) => body[1][k] - body[0][k]);
  const short = [0, 1, 2].filter((k) => S[k] - (reach[1][k] - reach[0][k]) > 0.003);
  record("dims", !bad.length && !short.length,
    `published ${S.map((s) => (s * 100).toFixed(1)).join(" x ")} cm, body ${dims.map((s) => (s * 100).toFixed(1)).join(" x ")} cm` +
    (bad.length ? `; past the published size by more than 3 mm: ${bad.slice(0, 8).map(([k, o]) => `${k} ${(o * 1000).toFixed(0)} mm`).join(", ")}` : "") +
    (short.length ? `; short of it by more than 3 mm in ${short.map((k) => "WHD"[k]).join(", ")}` : ""));
  record("stands", Math.abs(body[0][1]) <= 0.002 && (wall ? Math.abs(body[0][2]) <= 0.002 && Math.abs(body[0][0] + body[1][0]) / 2 <= 0.005
    : Math.abs(body[0][0] + body[1][0]) / 2 <= 0.005 && Math.abs(body[0][2] + body[1][2]) / 2 <= 0.02),
    `lowest point ${(body[0][1] * 1000).toFixed(1)} mm, centre x ${((body[0][0] + body[1][0]) / 2 * 1000).toFixed(1)} mm, ` +
    (wall ? `back at z ${(body[0][2] * 1000).toFixed(1)} mm (a wall unit's back is at z 0)` : `centre z ${((body[0][2] + body[1][2]) / 2 * 1000).toFixed(1)} mm`));

  const anims = doc.getRoot().listAnimations().map((a) => a.getName());
  // stateClips writes Rest plus one clip per one-part move (n x 2^n); files built before 30 Oct have a clip for every
  // pair of states (2^n x (2^n - 1)), which plays the same
  const n = parts.length, wantClips = [1 + n * 2 ** n, 1 + 2 ** n * (2 ** n - 1)];
  record("clips", anims[0] === "Rest" && wantClips.includes(anims.length) && anims.slice(1).every((a) => new RegExp(`^S[01]{${n}}_[01]{${n}}$`).test(a)),
    `${anims.length} clips, first "${anims[0]}" (need Rest first, then ${wantClips[0] - 1} one-part moves)`);

  const grained = doc.getRoot().listMaterials().filter((m) => m.getNormalTexture() && m.getNormalTextureInfo()?.getTexCoord() === 1).map((m) => m.getName());
  record("grain", grained.length > 0, grained.length ? `${grained.length} materials with surface grain (${grained.slice(0, 5).join(", ")}${grained.length > 5 ? "…" : ""})` : "no material has surface grain (STANDARD 4.3)");

  if (isFridge) {
    record("stock", stockCount > 0 && !stockOut.size, `${stockCount} stock items tagged for Fill${stockOut.size ? `; outside the fridge: ${[...stockOut].slice(0, 6).map(([k, o]) => `${k} ${(o * 1000).toFixed(0)} mm`).join(", ")}` : ""}`);
    const fit = run("node", [`${B3D}/qa_fit.mjs`, file(entry.glb)], { timeout: 600000 });
    const m1 = fit.stdout.match(/(\d+) items, (\d+) with problems/), m2 = fit.stdout.match(/doors shut: (\d+) clashes/);
    fs.writeFileSync(`${OUT}/qa_fit.txt`, fit.stdout + fit.stderr);
    record("fit-trays", !!m1 && +m1[2] === 0 && !!m2 && +m2[1] === 0, m1 ? `${m1[1]} items, ${m1[2]} with problems; ${m2 ? m2[1] : "?"} clashes with the doors shut (qa_fit.txt)` : `qa_fit failed: ${tail(fit.stderr)}`);
    const qb = run("node", [`${B3D}/qa_bounds.mjs`, file(entry.glb)]);
    const m3 = qb.stdout.match(/stock items (\d+) problems (\d+)/);
    fs.writeFileSync(`${OUT}/qa_bounds.txt`, qb.stdout + qb.stderr);
    record("compartments", !!m3 && +m3[2] === 0, m3 ? `${m3[1]} items, ${m3[2]} outside their compartment` : `qa_bounds failed: ${tail(qb.stderr)}`);
    record("trays", parts.some((p) => p.text && p.needs), parts.some((p) => p.text && p.needs) ? "the trays come out (a part with its own button words, inside a door)" : "no removable trays part (STANDARD 5.1)");
  }
  const zf = run("node", [`${B3D}/zfight.mjs`, file(entry.glb)], { timeout: 600000 });
  fs.writeFileSync(`${OUT}/zfight.txt`, zf.stdout + zf.stderr);
  const pairs = [...zf.stdout.matchAll(/^\s+([\d.]+) cm2/gm)].map((m) => +m[1]);
  record("flicker", !pairs.some((a) => a >= 5), `${pairs.length} surface pairs in the same plane, ${pairs.filter((a) => a >= 5).length} of 5 cm2 or more (zfight.txt)`, pairs.length > 0 && !pairs.some((a) => a >= 5));
}

// ── 3. the Apple files: validation, RealityKit, meshes, grain, size, textures, renders ──
const usdzFiles = (entry.finishes || []).flatMap((f) => wall ? [f.usdz] : [f.usdz, f.usdz.replace(/\.usdz$/, "-free.usdz")]).filter(exists);
for (const u of usdzFiles) {
  const name = path.basename(u, ".usdz"), f = file(u), size = fs.statSync(f).size;
  record(`usdz-size`, size / 1048576 <= BUDGET.usdz, `${name}: ${MB(size)} MB (budget ${BUDGET.usdz} MB)`);
  const chk = run(`${SITE}/tools/usdenv/bin/python`, [`${SCR}/usdz_check.py`, f]);
  let st = null; try { st = JSON.parse(chk.stdout.trim().split("\n").pop()); } catch {}
  record("usd-valid", !!st && st.issues === 0, st ? `${name}: ${st.issues} validation issues${st.issues ? ` (${st.issueList.slice(0, 3).join("; ")})` : ""}` : `${name}: check failed: ${tail(chk.stderr)}`);
  const rk = run(`${SITE}/tools/bin/rk_load`, [f]);
  const ents = +(rk.stdout.match(/OK\s+(\d+) entities/) || [])[1];
  record("realitykit", /^OK/m.test(rk.stdout) && ents <= BUDGET.entities, `${name}: ${/^OK/m.test(rk.stdout) ? `loads, ${ents} entities (budget ${BUDGET.entities})` : tail(rk.stdout + rk.stderr)}`);
  if (st) {
    record("meshes", st.meshes <= BUDGET.meshes, `${name}: ${st.meshes} meshes (budget ${BUDGET.meshes}), ${st.triangles} triangles, ${st.materials} materials, ${st.seeThrough} see-through`);
    const foreign = Object.entries(st.textures).filter(([n, h]) => !glbHashes.has(h) && !/grain_/.test(n));
    record("textures", !foreign.length, foreign.length ? `${name}: ${foreign.length} textures not in its own GLB: ${foreign.slice(0, 4).map(([n]) => n).join(", ")}` : `${name}: all ${Object.keys(st.textures).length} textures match the GLB's`);
  }
  const rm = run(`${SITE}/tools/bin/rk_materials`, [f]);
  const g = +(rm.stdout.match(/materials with grain: (\d+)/) || [])[1];
  const sz = rm.stdout.match(/W ([\d.]+) x H ([\d.]+) x D ([\d.]+) cm, lowest point y = (-?[\d.]+) cm/);
  const S = ["w", "h"].map((k) => cm(entry.size[k]) * 100);
  record("rk-grain", g > 0, `${name}: RealityKit picks up the grain on ${g || 0} materials`);
  record("rk-size", !!sz && Math.abs(+sz[1] - S[0]) <= 0.35 && Math.abs(+sz[2] - S[1]) <= 0.35 && Math.abs(+sz[4]) <= 0.2,
    sz ? `${name}: RealityKit places W ${sz[1]} x H ${sz[2]} cm (published ${S[0]} x ${S[1]}), lowest point ${sz[4]} cm` : `${name}: no size from rk_materials`, false);
  if (!fast && !/-free$/.test(name)) {
    for (const pose of ["closed", "open"]) run(`${SITE}/tools/bin/render_usdz`, [f, `${OUT}/apple-${name}-${pose}.png`, ...(pose === "open" ? ["open"] : [])], { timeout: 300000 });
    record("apple-render", ["closed", "open"].every((p) => fs.existsSync(`${OUT}/apple-${name}-${p}.png`)), `${name}: Apple renders apple-${name}-closed.png and -open.png (look at them)`);
  }
}

// ── 4. the page tests, on a staging catalogue with only this product on show ──
let server = null;
if (!fast) {
  // at most three gates run their browsers at once (GATE_SLOTS sets it): with seven agents gating together the Mac's load
  // reached 30-70 and page tests timed out with two, until the tests waited on the page instead of fixed times. A slot is a
  // folder in .work/; a slot whose gate has died is taken over.
  const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  let slot = null;
  const slots = [...Array(Math.max(1, +(process.env.GATE_SLOTS || 3))).keys()];
  for (let waited = 0; !slot; waited++) {
    for (const s of slots) {
      const dir = `${SITE}/.work/gate-pages-${s}.lock`;
      try { fs.mkdirSync(dir, { recursive: false }); fs.writeFileSync(`${dir}/pid`, String(process.pid)); slot = dir; break; } catch {}
      let pid = 0; try { pid = +fs.readFileSync(`${dir}/pid`, "utf8"); } catch {}
      const old = Date.now() - (fs.statSync(dir, { throwIfNoEntry: false })?.mtimeMs ?? 0) > 60000;
      if ((pid && !alive(pid)) || (!pid && old)) fs.rmSync(dir, { recursive: true, force: true });
    }
    if (!slot) { if (waited % 12 === 0) console.log(`waiting for a free page-test slot (${slots.length} gates already running their browsers)`); await new Promise((r) => setTimeout(r, 5000)); }
  }
  process.on("exit", () => { try { if (+fs.readFileSync(`${slot}/pid`, "utf8") === process.pid) fs.rmSync(slot, { recursive: true, force: true }); } catch {} });
  const staged = { ...catalogue, products: catalogue.products.filter((p) => p.id !== id).map((p) => ({ ...p, hidden: true })) };
  const mine = { ...entry }; delete mine.hidden; staged.products.push(mine);
  fs.writeFileSync(`${OUT}/catalog.json`, JSON.stringify(staged));
  server = spawn("node", [`${SCR}/serve.mjs`, SITE, String(PORT), `${SITE}/pipeline/testpages`], { env: { ...process.env, PRODUCTS: `${OUT}/catalog.json` }, stdio: "ignore" });
  const base = `http://127.0.0.1:${PORT}`;
  for (let t = 0; t < 50; t++) { try { if ((await fetch(`${base}/products.json`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  let p = PORT;
  const page = (key, script, argv, env = {}) => {
    const o = `${OUT}/${key}`;
    const r = run("node", [`${SCR}/${script}`, base, o, ...argv], { env: { PORT: String(++p), ...env }, timeout: 1200000 });
    fs.mkdirSync(o, { recursive: true }); fs.writeFileSync(`${o}/log.txt`, r.stdout + r.stderr);
    const fails = (r.stdout.match(/^\s*FAIL.*$/gm) || []).slice(0, 3).map((s) => s.trim());
    record(key, r.status === 0, r.status === 0 ? `${tail(r.stdout, 1)} (${key}/log.txt)` : `${fails.join(" | ") || tail(r.stdout + r.stderr)} (${key}/log.txt)`);
  };
  page("page-site", "test_site.mjs", [], { ONLY: id });
  page("page-features", "test_features.mjs", [], { ONLY: id });
  page("page-controls", "test_controls.mjs", [id]);
  page("page-arphone", "test_arphone.mjs", [id]);
  page("page-room", "test_room.mjs", []);
  { const o = `${OUT}/page-xr`; const r = run("node", [`${SCR}/test_xr.mjs`, base, o, `${SITE}/tools/iwer.min.js`, id], { env: { PORT: String(++p) }, timeout: 1200000 });
    fs.mkdirSync(o, { recursive: true }); fs.writeFileSync(`${o}/log.txt`, r.stdout + r.stderr);
    record("page-xr", r.status === 0, `${r.status === 0 ? tail(r.stdout, 1) : tail(r.stdout + r.stderr)} (page-xr/log.txt)`); }
  if (isFridge) page("page-organise", "test_organise.mjs", [id]);
  if (parts.some((q) => q.text && q.needs)) page("page-trays", "test_trays.mjs", [id]);

  // ── 5. the pictures a person must look at, next to the maker's photos ──
  const orbit = entry.orbit, [th, ph, rad] = orbit.split(" ");
  const bits = (on) => parts.map((q) => (on.includes(q.key) ? 1 : 0)).join("");
  const views = [`${orbit}`, `0deg ${ph} ${rad}`, `-40deg ${ph} ${rad}`, `90deg ${ph} ${rad}`, `180deg ${ph} ${rad}`, `0deg 10deg ${rad}`];
  for (const q of parts) { const outer = parts.filter((o) => o.key === q.needs).map((o) => o.key); views.push(`${orbit}|S${bits(outer)}_${bits([...outer, q.key])}`); }
  const r = run("node", [`${SCR}/compare.mjs`, base, entry.glb, `${OUT}/look`, "900", "1100", ...views], { env: { PORT: String(++p) }, timeout: 600000 });
  const shots = fs.existsSync(`${OUT}/look`) ? fs.readdirSync(`${OUT}/look`).filter((f) => f.endsWith(".png")) : [];
  record("renders", shots.length === views.length, `${shots.length} of ${views.length} views rendered in look/ ${r.status ? tail(r.stderr) : ""}`);
  server.kill();
  fs.rmSync(slot, { recursive: true, force: true });
  fs.writeFileSync(`${OUT}/REVIEW.md`, [
    `# ${entry.brand} ${entry.model}: what a person must look at (STANDARD.md section 7)`, "",
    "Open each picture next to the maker's photo at the same angle. Tick a line only when it matches; write what is wrong otherwise.", "",
    ...views.map((v, i) => `- [ ] look/view-${i}.png: ${["default view", "front", "3/4 left", "side", "back", "top"][i] || `${parts[i - 6]?.label || parts[i - 6]?.key} open`} (${v})`),
    ...usdzFiles.filter((u) => !/-free\.usdz$/.test(u)).flatMap((u) => [`- [ ] apple-${path.basename(u, ".usdz")}-closed.png and -open.png: the iPhone file looks like the web model`]),
    "- [ ] every word, number and icon on the product is sharp at the 4 degree close-up (double-click on the product page)",
    "- [ ] the grain at the 4 degree close-up, grain on and off, from the default angle and straight on",
    ...(isFridge ? ["- [ ] the fridge after Fill: every shelf, basket and drawer, close up, next to the maker's stocked photo; food looks real, vegetarian plus eggs"] : []),
    "- [ ] the back and underside next to the maker's rear photo: cord, plug, hoses, labels", "",
  ].join("\n"));
}

// ── report ──
const fails = results.filter((r) => r.status === "FAIL");
fs.writeFileSync(`${OUT}/REPORT.md`, [
  `# Gate: ${entry.brand} ${entry.model} (${id})`, "",
  `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC, ${fast ? "fast run (no page tests or renders): this is not a pass" : "full run"}. ` +
  `${fails.length ? `${fails.length} checks FAIL.` : "Every automatic check passes. A person must still tick REVIEW.md."}`, "",
  "| Check | Result | Detail |", "|---|---|---|",
  ...results.map((r) => `| ${r.key} | ${r.status} | ${r.detail.replace(/\|/g, "/")} |`), "",
].join("\n"));
console.log(`\n${fails.length} failed, ${results.filter((r) => r.status === "WARN").length} warnings. Report: ${OUT}/REPORT.md${fast ? " (fast run: not a pass)" : ""}`);
process.exit(fails.length || fast ? 1 : 0);
