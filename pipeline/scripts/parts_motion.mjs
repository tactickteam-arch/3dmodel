// The gate's "parts-motion" check (STANDARD.md section 5): every moving part moves like the real one in EVERY viewer.
// The product page plays the GLB's clips; the headsets (xr.js) and the showroom (showroom.js) turn each part by its
// products.json `angle` (or `slide`); Quick Look plays the USDZ's PoseOpen. On 25 Nov 2026 five ACs' louvres swung
// into the unit in the headsets and showroom while the page and every test looked right, because products.json still
// held the old angles after the GLBs and USDZs were corrected. This check makes those disagree loudly, and makes a
// part that goes the wrong way, or through the body, fail before anyone sees it.
//
// For each part (and each node its `also` moves with it):
//  a. consistency: the entry's angle/slide, applied to the GLB node's own rest pose exactly as xr.js and showroom.js
//     do (closed.multiply(axisAngle), position + slide), equals the end pose of every GLB clip that opens it (and the
//     start of every clip that closes it, within 0.5 degrees and 2 mm, also at 25/50/75 % of each clip), and the
//     PoseOpen/PoseClosed written into every colour's USDZ, -free copies included. The tap zones hold the part's box,
//     closed and open, within 1 cm. A node xr.js can't find, or finds twice, fails.
//  b. direction: posed the way xr.js poses it, at 25/50/75/100 % (slerp, as the viewers animate it), the part moves
//     the way its kind does: a door's free edge comes forward, a lid's free edge rises, an AC louvre's free edge goes
//     out and/or down (never back or up into the outlet), an AC front panel lifts up and out, and a slide never goes
//     back into the body. Kinds come from the part's key, label and node.
//  c. no intrusion: the closed product (the parts this one needs open, every other part shut, this one shut) is
//     voxelised at 5 mm and filled from outside, so what it encloses counts as inside. At 25/50/75/100 % open no more
//     than 1 % of the part's points may be 10 mm or more inside it where they weren't when shut, and none 30 mm or more
//     (a hinge or a gasket may touch).
// A part can be excused from b and c (never a) only in pipeline/entries/<id>.gate.json, with its reason and source:
//   {"motion": {"<part key>": {"reason": "...", "source": "<maker's page, manual page or photo>"}}}
//
// usage: node pipeline/scripts/parts_motion.mjs [<id> ...|--all] [--products <products.json>] [--entry <entry file>]
//   --all checks every product on show; exits 1 if any part fails. --tsv <file> also writes one row per part.
//   Debugging: MOTION_DEBUG=1 prints the first points found inside the body; MOTION_DUMP=<file.json> MOTION_PART=<key>
//   writes the body, the part shut and at its worst step, and those points, for drawing sections.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const B3D = `${SITE}/pipeline/build3d`;
const req = createRequire(`${B3D}/package.json`);
const { NodeIO } = await import(req.resolve("@gltf-transform/core"));
const { ALL_EXTENSIONS } = await import(req.resolve("@gltf-transform/extensions"));
const THREE = await import(pathToFileURL(`${B3D}/node_modules/three/build/three.module.js`).href);

const TOL_DEG = 0.5, TOL_M = 0.002;          // a: poses agree
const ZONE_TOL = 0.01;                        // a: a tap zone may be up to 1 cm short of the part's box
const DIR_TOL = 0.005, DIR_MIN = 0.02;        // b: never more than 5 mm the wrong way; the free edge moves 2 cm (or a quarter of its reach)
const VOX = 0.005, DEEP = 3, DEEPEST = 7;     // c: 5 mm voxels; "inside" = 3+ voxels (10+ mm) in, "far inside" = 7+ (30+ mm)
const FRAC_MAX = 0.01;                        // c: at most 1 % of the part's points inside
const STEPS = [0.25, 0.5, 0.75, 1];
const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const deg = (r) => (r * 180) / Math.PI;
const qAngle = (a, b) => deg(2 * Math.acos(Math.min(1, Math.abs(a.dot(b)))));
const cm = (m) => (m * 100).toFixed(1);
const fmtA = (a) => `${a > 0 ? "+" : ""}${+a.toFixed(1)}`;
// USD names, as make_usdz.mjs writes them
const safe = (s) => (s || "Node").replace(/[^A-Za-z0-9_]/g, "_").replace(/^([0-9])/, "_$1");

// the kind of a part, from its key, label and node: what "the right way" means for it
export function kindOf(entry, p) {
  if (p.slide) return "slide";
  const s = `${p.key} ${p.label || ""} ${p.node}`.toLowerCase();
  if (entry.category === "Air conditioner") {
    if (/panel/.test(s)) return "panel";
    if (/louvre|flap|vane/.test(s)) return "louvre";
  }
  if (/lid/.test(s)) return "lid";
  if (/door|flap|cover|filter|zone/.test(s)) return "door";
  return null;
}
const needsOf = (p) => [].concat(p.needs || []);

// the first USDA in a USDZ (a stored zip whose first file is the scene; package_usdz.py keeps it as text)
function usdaOf(file) {
  const b = fs.readFileSync(file);
  if (b.readUInt32LE(0) !== 0x04034b50) return null;
  const size = b.readUInt32LE(18), nl = b.readUInt16LE(26), xl = b.readUInt16LE(28);
  const name = b.subarray(30, 30 + nl).toString();
  if (!name.endsWith(".usda") || b.readUInt16LE(8) !== 0) return null;
  return b.subarray(30 + nl + xl, 30 + nl + xl + size).toString("utf8");
}
function usdPose(text, name) {
  const all = [...text.matchAll(new RegExp(`def Xform "${name}"\\s*\\{([^}]*)\\}`, "g"))];
  if (!all.length) return null;
  const body = all[0][1];
  const t = body.match(/xformOp:translate = \(([^)]*)\)/), o = body.match(/xformOp:orient = \(([^)]*)\)/);
  const tv = t ? t[1].split(",").map(Number) : [0, 0, 0], ov = o ? o[1].split(",").map(Number) : [1, 0, 0, 0];
  return { t: new THREE.Vector3(...tv), q: new THREE.Quaternion(ov[1], ov[2], ov[3], ov[0]), count: all.length };
}

// a GLB animation sampler's value at time t (LINEAR, as three.js and model-viewer play it; STEP holds)
function sample(ch, t) {
  const s = ch.getSampler(), inp = s.getInput().getArray(), out = s.getOutput().getArray();
  const k = ch.getTargetPath() === "rotation" ? 4 : 3, n = inp.length;
  const at = (i) => Array.from(out.slice(i * k, i * k + k));
  const make = (v) => (k === 4 ? new THREE.Quaternion(...v) : new THREE.Vector3(...v));
  if (t <= inp[0]) return make(at(0));
  if (t >= inp[n - 1]) return make(at(n - 1));
  let i = 0; while (inp[i + 1] < t) i++;
  if (s.getInterpolation() === "STEP") return make(at(i));
  const u = (t - inp[i]) / (inp[i + 1] - inp[i]);
  if (k === 4) return new THREE.Quaternion().slerpQuaternions(make(at(i)), make(at(i + 1)), u);
  return new THREE.Vector3().lerpVectors(make(at(i)), make(at(i + 1)), u);
}

// ── the model as a tree we can pose ──
function sceneOf(doc) {
  const root = doc.getRoot(), scene = root.getDefaultScene() || root.listScenes()[0];
  const parentOf = new Map();
  for (const n of root.listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
  const stockTagged = (n) => { for (let c = n; c; c = parentOf.get(c)) if (c.getExtras()?.stock) return true; return false; };
  const nodes = [];
  const walk = (n, parent) => {
    const r = { n, name: n.getName(), parent, children: [], t: new THREE.Vector3(...n.getTranslation()), q: new THREE.Quaternion(...n.getRotation()), s: new THREE.Vector3(...n.getScale()), stock: stockTagged(n), geo: null };
    const mesh = n.getMesh();
    if (mesh && !r.stock) {
      const pos = [], idx = [];
      for (const pr of mesh.listPrimitives()) {
        const a = pr.getAttribute("POSITION"); if (!a) continue;
        const base = pos.length / 3, v = [0, 0, 0];
        for (let i = 0; i < a.getCount(); i++) { a.getElement(i, v); pos.push(v[0], v[1], v[2]); }
        const ix = pr.getIndices();
        if (ix) for (let i = 0; i < ix.getCount(); i++) idx.push(base + ix.getScalar(i));
        else for (let i = 0; i < a.getCount(); i++) idx.push(base + i);
      }
      if (pos.length) r.geo = { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
    }
    nodes.push(r);
    if (parent) parent.children.push(r);
    for (const c of n.listChildren()) walk(c, r);
    return r;
  };
  const tops = scene.listChildren().map((n) => walk(n, null));
  return { nodes, tops };
}
// world matrices for a pose: Map(record -> {q, t}) overrides a node's local rotation/translation
function worldOf(sc, pose) {
  const W = new Map();
  const go = (r, M) => {
    const o = pose.get(r);
    const m = new THREE.Matrix4().compose(o?.t || r.t, o?.q || r.q, r.s);
    const w = M ? M.clone().multiply(m) : m;
    W.set(r, w);
    for (const c of r.children) go(c, w);
  };
  for (const r of sc.tops) go(r, null);
  return W;
}
const subtree = (r, out = []) => { out.push(r); for (const c of r.children) subtree(c, out); return out; };

// ── the closed product as a solid: voxels of every surface, filled from outside; depth = voxels to the outside ──
function hullOf(sc, W, skip = null, only = null) {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], v = new THREE.Vector3();
  const tris = [];
  for (const r of sc.nodes) {
    if (!r.geo || skip?.has(r) || (only && !only.has(r))) continue;
    const M = W.get(r), p = r.geo.pos, wp = new Float32Array(p.length);
    for (let i = 0; i < p.length; i += 3) {
      v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(M);
      wp[i] = v.x; wp[i + 1] = v.y; wp[i + 2] = v.z;
      for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], wp[i + k]); hi[k] = Math.max(hi[k], wp[i + k]); }
    }
    tris.push([wp, r.geo.idx]);
  }
  return { lo, hi, tris };
}
function voxelise(h, box) {
  // the grid covers the closed product's box (parts posed elsewhere are cut off at it; outside it is outside)
  const PAD = 3, o = box.lo.map((x) => x - PAD * VOX), dim = [0, 1, 2].map((k) => Math.ceil((box.hi[k] - box.lo[k]) / VOX) + 2 * PAD + 1);
  const [nx, ny, nz] = dim, N = nx * ny * nz, solid = new Uint8Array(N);
  const id = (x, y, z) => (z * ny + y) * nx + x;
  const mark = (x, y, z) => {
    const i = Math.floor((x - o[0]) / VOX), j = Math.floor((y - o[1]) / VOX), k = Math.floor((z - o[2]) / VOX);
    if (i > 0 && j > 0 && k > 0 && i < nx - 1 && j < ny - 1 && k < nz - 1) solid[id(i, j, k)] = 1;
  };
  const step = VOX * 0.5;
  for (const [wp, idx] of h.tris) {
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
      const ax = wp[a], ay = wp[a + 1], az = wp[a + 2], bx = wp[b] - ax, by = wp[b + 1] - ay, bz = wp[b + 2] - az, cx = wp[c] - ax, cy = wp[c + 1] - ay, cz = wp[c + 2] - az;
      const e = Math.max(Math.hypot(bx, by, bz), Math.hypot(cx, cy, cz), Math.hypot(bx - cx, by - cy, bz - cz));
      const n = Math.max(1, Math.ceil(e / step));
      for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const u = i / n, w = j / n; mark(ax + bx * u + cx * w, ay + by * u + cy * w, az + bz * u + cz * w); }
    }
  }
  // flood the outside from the grid's border, then count each other voxel's steps to the outside
  const depth = new Uint8Array(N).fill(255), q = new Int32Array(N);
  let qh = 0, qt = 0;
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++)
    if (x === 0 || y === 0 || z === 0 || x === nx - 1 || y === ny - 1 || z === nz - 1) { const i = id(x, y, z); depth[i] = 0; q[qt++] = i; }
  const nb = [1, -1, nx, -nx, nx * ny, -nx * ny];
  while (qh < qt) { const i = q[qh++]; for (const d of nb) { const j = i + d; if (j >= 0 && j < N && depth[j] === 255 && !solid[j]) { depth[j] = 0; q[qt++] = j; } } }
  // now every voxel still 255 is a surface or enclosed: BFS out from the outside layer
  qh = 0;
  while (qh < qt) { const i = q[qh++], d = depth[i]; for (const dd of nb) { const j = i + dd; if (j >= 0 && j < N && depth[j] === 255) { depth[j] = Math.min(254, d + 1); q[qt++] = j; } } }
  return (x, y, z) => {
    const i = Math.floor((x - o[0]) / VOX), j = Math.floor((y - o[1]) / VOX), k = Math.floor((z - o[2]) / VOX);
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return 0;
    return depth[id(i, j, k)];
  };
}

// ── the check for one product ──
// entry: its products.json entry; glbFile, usdzFiles: absolute paths; own: its <id>.gate.json (for "motion" waivers)
export async function partsMotion({ entry, glbFile, usdzFiles = [], own = {}, doc = null }) {
  doc = doc || (await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(glbFile));
  const sc = sceneOf(doc);
  const parts = entry.parts || [];
  const byName = new Map();
  for (const r of sc.nodes) byName.set(r.name, [...(byName.get(r.name) || []), r]);
  const usdas = usdzFiles.map((f) => ({ f, text: usdaOf(f) }));
  const anims = doc.getRoot().listAnimations();
  const results = [];
  const rest = worldOf(sc, new Map());
  // the closed box: every part shut
  const closedBox = (() => { const h = hullOf(sc, rest); return { lo: h.lo, hi: h.hi }; })();
  const hulls = new Map();

  // each part's moving nodes: itself and its `also` companions, each with its own hinge or slide
  const movers = (p) => [{ node: p.node, axis: p.axis, angle: p.angle, slide: p.slide }, ...(p.also || []).map((a) => ({ node: a.node, axis: a.axis || p.axis, angle: a.angle, slide: a.slide }))];
  // xr.js / showroom.js: open = closed.multiply(axisAngle(axis, angle)), out = at + slide; in between: slerp / lerp
  const poseAt = (r, m, t) => {
    if (m.slide) return { q: r.q.clone(), t: r.t.clone().add(new THREE.Vector3(...m.slide).multiplyScalar(t)) };
    const open = r.q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(AXES[m.axis], THREE.MathUtils.degToRad(m.angle)));
    return { q: new THREE.Quaternion().slerpQuaternions(r.q, open, t), t: r.t.clone() };
  };
  // the parts this one needs open (and what those need), as togglePart opens them
  const needClosure = (p, seen = new Set()) => { for (const k of needsOf(p)) if (!seen.has(k)) { seen.add(k); const o = parts.find((x) => x.key === k); if (o) needClosure(o, seen); } return seen; };

  for (const [pi, p] of parts.entries()) {
    const fails = [], notes = [];
    const kind = kindOf(entry, p);
    const ms = movers(p);
    const recs = ms.map((m) => { const r = byName.get(m.node) || []; return r; });
    const missing = ms.filter((m, i) => !recs[i].length).map((m) => m.node), twice = ms.filter((m, i) => recs[i].length > 1).map((m) => m.node);
    const how = p.slide ? `slide ${JSON.stringify(p.slide)} m` : `${p.axis} ${fmtA(p.angle)}°`;
    const head = `${p.key} (${p.node}, ${how}${p.also?.length ? `, with ${p.also.map((a) => a.node).join(", ")}` : ""})`;
    if (missing.length || twice.length) {
      results.push({ part: p.key, ok: false, detail: `${head}: ${missing.length ? `no node ${missing.join(", ")} in the GLB (the headsets and showroom can't move it)` : ""}${twice.length ? ` node ${twice.join(", ")} appears more than once (the viewers may pick a different one)` : ""}` });
      continue;
    }
    const R = recs.map((r) => r[0]);
    if (!p.slide && !(p.axis in AXES)) { results.push({ part: p.key, ok: false, detail: `${head}: axis "${p.axis}" is not x, y or z` }); continue; }
    if (!p.slide && Math.abs(p.angle) > 180) fails.push(`angle ${p.angle}° is past 180°: every viewer would slerp it the short way round`);

    // ── a. the GLB's clips ──
    let clipsSeen = 0;
    const glbBad = [];
    for (const a of anims) {
      const name = a.getName();
      const m = name.match(/^S([01]+)_([01]+)$/);
      const from = m ? m[1] : "0".repeat(parts.length), to = m ? m[2] : from;
      if (!m && name !== "Rest") continue;
      if (from.length !== parts.length) continue;
      const dur = Math.max(...a.listSamplers().map((s) => { const x = s.getInput().getArray(); return x[x.length - 1]; }), 0);
      for (const [mi, mv] of ms.entries()) {
        const r = R[mi];
        const path = mv.slide ? "translation" : "rotation";
        const ch = a.listChannels().find((c) => c.getTargetNode() === r.n && c.getTargetPath() === path);
        const t0 = +from[pi], t1 = +to[pi];
        if (!ch) { if (name !== "Rest" || t0 !== t1) glbBad.push(`${name}: no ${path} track for ${mv.node}`); continue; }
        clipsSeen++;
        const fracs = name === "Rest" ? [0, 1] : [0, 0.25, 0.5, 0.75, 1];
        for (const f of fracs) {
          const want = poseAt(r, mv, t0 + (t1 - t0) * f), got = sample(ch, f * dur);
          const off = mv.slide ? got.distanceTo(want.t) : qAngle(got, want.q);
          if (off > (mv.slide ? TOL_M : TOL_DEG)) {
            let gl = "";
            if (!mv.slide) { const rel = r.q.clone().invert().multiply(got); const ax = AXES[mv.axis]; gl = `${fmtA(deg(2 * Math.atan2(rel.x * ax.x + rel.y * ax.y + rel.z * ax.z, rel.w)))}° about ${mv.axis}`; }
            else gl = `${got.clone().sub(r.t).toArray().map((x) => +x.toFixed(3)).join(", ")} m`;
            glbBad.push(`${name} at ${f * 100}%: GLB ${mv.node} ${gl}, entry ${mv.slide ? JSON.stringify(mv.slide) + " m" : fmtA(mv.angle * (t0 + (t1 - t0) * f)) + "°"}`);
            break;
          }
        }
      }
    }
    if (glbBad.length) fails.push(`the GLB's clips disagree with the entry (${glbBad.length}): ${glbBad.slice(0, 2).join("; ")}`);
    else if (!clipsSeen) fails.push("no GLB clip moves it (the product page can't open it)");

    // ── a. every Apple file ──
    const usdBad = [];
    for (const { f, text } of usdas) {
      const nm = path.basename(f, ".usdz");
      if (text == null) { usdBad.push(`${nm}: not a text scene, can't read its poses`); continue; }
      for (const [mi, mv] of ms.entries()) {
        const r = R[mi];
        for (const [label, t] of [["PoseClosed", 0], ["PoseOpen", 1]]) {
          const got = usdPose(text, safe(`${mv.node}_${label}`));
          if (!got) { usdBad.push(`${nm}: no ${mv.node}_${label}`); continue; }
          const want = poseAt(r, mv, t);
          const dq = qAngle(got.q, want.q), dt = got.t.distanceTo(want.t);
          if (dq > TOL_DEG || dt > TOL_M) {
            const rel = r.q.clone().invert().multiply(got.q), ax = AXES[mv.axis || "x"];
            usdBad.push(`${nm} ${mv.node}_${label}: ${mv.slide ? `moved ${got.t.clone().sub(r.t).toArray().map((x) => +x.toFixed(3)).join(", ")} m` : `${fmtA(deg(2 * Math.atan2(rel.x * ax.x + rel.y * ax.y + rel.z * ax.z, rel.w)))}°`}${dt > TOL_M && !mv.slide ? `, hinge ${(dt * 1000).toFixed(0)} mm off` : ""}, entry ${mv.slide ? JSON.stringify(t ? mv.slide : [0, 0, 0]) : fmtA(mv.angle * t) + "°"}`);
          }
        }
      }
    }
    if (usdBad.length) fails.push(`the Apple files disagree with the entry (${usdBad.length}): ${usdBad.slice(0, 2).join("; ")}`);

    // ── a. the tap zones hold the part, closed and open ──
    const boxOf = (W) => {
      const b = new THREE.Box3(), v = new THREE.Vector3();
      for (const r of R) for (const s of subtree(r)) if (s.geo) { const M = W.get(s), q = s.geo.pos; for (let i = 0; i < q.length; i += 3) b.expandByPoint(v.set(q[i], q[i + 1], q[i + 2]).applyMatrix4(M)); }
      return b;
    };
    const openPose = new Map(R.map((r, i) => [r, poseAt(r, ms[i], 1)]));
    const boxes = { closed: boxOf(rest), open: boxOf(worldOf(sc, openPose)) };
    const zoneBad = [];
    for (const k of ["closed", "open"]) {
      const z = p.zone?.[k];
      if (!z) { zoneBad.push(`no ${k} zone`); continue; }
      const b = boxes[k], out = [];
      for (let a = 0; a < 3; a++) {
        const lo = z[0][a] - b.min.getComponent(a), hi = b.max.getComponent(a) - z[1][a];
        if (lo > ZONE_TOL) out.push(`${"xyz"[a]} min ${cm(lo)} cm`);
        if (hi > ZONE_TOL) out.push(`${"xyz"[a]} max ${cm(hi)} cm`);
      }
      if (out.length) zoneBad.push(`${k} zone short of the part by ${out.join(", ")}`);
    }
    if (zoneBad.length) fails.push(`tap zone: ${zoneBad.join("; ")}`);

    // ── b and c: the way it moves, and nothing inside the body ──
    const need = needClosure(p);
    const stateKey = [...need].sort().join("+");
    const statePose = new Map();
    for (const k of need) { const o = parts.find((x) => x.key === k); if (!o) continue; for (const m of movers(o)) for (const r of byName.get(m.node) || []) statePose.set(r, poseAt(r, m, 1)); }
    const mine = new Set(R.flatMap((r) => subtree(r)));
    // A part that turns is checked against the product with it shut: what the body and the shut part enclose (an AC's
    // insides behind its louvre, a cabinet behind its door) is inside. A part that slides runs on its own track (a
    // crisper under a fixed glass shelf), so it is checked against the body without it.
    let depthAt;
    if (p.slide) depthAt = voxelise(hullOf(sc, worldOf(sc, statePose), mine), closedBox);
    else {
      if (!hulls.has(stateKey)) hulls.set(stateKey, voxelise(hullOf(sc, worldOf(sc, statePose)), closedBox));
      depthAt = hulls.get(stateKey);
    }
    // the part's points: every vertex and about one point per square centimetre over every face, of its own meshes and
    // everything under it, in each node's local frame. A hinge, gasket or seal may touch the body, so its points don't count.
    const pts = [];
    for (const [mi, r] of R.entries()) for (const s of subtree(r)) {
      if (!s.geo || /gasket|hinge|seal/i.test(s.name)) continue;
      const q = s.geo.pos, ix = s.geo.idx;
      for (let i = 0; i < q.length; i += 3) pts.push([mi, s, q[i], q[i + 1], q[i + 2]]);
      for (let t = 0; t + 2 < ix.length; t += 3) {
        const a = ix[t] * 3, b = ix[t + 1] * 3, c = ix[t + 2] * 3;
        const ux = q[b] - q[a], uy = q[b + 1] - q[a + 1], uz = q[b + 2] - q[a + 2], wx = q[c] - q[a], wy = q[c + 1] - q[a + 1], wz = q[c + 2] - q[a + 2];
        const area = 0.5 * Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx);
        const n = Math.ceil(Math.sqrt(2 * area) / 0.01); // about one point per square centimetre
        if (n < 2) continue;
        for (let i = 1; i < n; i++) for (let j = 1; j < n - i; j++) { const u = i / n, w = j / n, o = 1 - u - w; pts.push([mi, s, q[a] * o + q[b] * u + q[c] * w, q[a + 1] * o + q[b + 1] * u + q[c + 1] * w, q[a + 2] * o + q[b + 2] * u + q[c + 2] * w]); }
      }
    }
    const at = (t) => {
      const pose = new Map(statePose);
      for (const [mi, r] of R.entries()) pose.set(r, poseAt(r, ms[mi], t));
      return worldOf(sc, pose);
    };
    const W0 = at(0), v = new THREE.Vector3();
    // what the part itself fills when shut (a drawer's box, a door's thickness) is not the body: moving through the space
    // it leaves is fine
    const ownH = hullOf(sc, W0, null, mine);
    const ownVox = voxelise(ownH, { lo: ownH.lo, hi: ownH.hi });
    // within a voxel of it counts (a face exactly on a voxel boundary would otherwise fall either side)
    const ownAt = (x, y, z) => Math.max(ownVox(x, y, z), ownVox(x + VOX, y, z), ownVox(x - VOX, y, z), ownVox(x, y + VOX, z), ownVox(x, y - VOX, z), ownVox(x, y, z + VOX), ownVox(x, y, z - VOX));
    const base = pts.map(([, s, x, y, z]) => { v.set(x, y, z).applyMatrix4(W0.get(s)); return depthAt(v.x, v.y, v.z); });
    let worstFrac = 0, worstDeep = 0, worstT = 0, worstN = 0;
    for (const t of STEPS) {
      const W = at(t);
      let n = 0, deepest = 0;
      for (const [i, [, s, x, y, z]] of pts.entries()) {
        v.set(x, y, z).applyMatrix4(W.get(s));
        const d = depthAt(v.x, v.y, v.z);
        if (d >= DEEP && base[i] < DEEP && ownAt(v.x, v.y, v.z) === 0) {
          n++; deepest = Math.max(deepest, d);
          if (process.env.MOTION_DEBUG && n <= 12) console.error(`  ${p.key} t${t} ${s.name} (${v.toArray().map((x) => x.toFixed(3)).join(", ")}) depth ${d}`);
        }
      }
      const frac = n / Math.max(1, pts.length);
      if (frac > worstFrac || (frac === worstFrac && deepest > worstDeep)) { worstFrac = frac; worstDeep = deepest; worstT = t; worstN = n; }
    }
    const intrudes = worstFrac > FRAC_MAX || worstDeep >= DEEPEST;
    if (process.env.MOTION_DUMP && process.env.MOTION_PART === p.key) {
      // debugging: the body (as the hull sees it), the part shut and at its worst step, and the points inside, as JSON
      const tri = (W, set, inc) => { const out = []; for (const r of sc.nodes) { if (!r.geo || inc !== set.has(r)) continue; const M = W.get(r), q = r.geo.pos, ix = r.geo.idx; for (let k = 0; k < ix.length; k++) { v.set(q[ix[k] * 3], q[ix[k] * 3 + 1], q[ix[k] * 3 + 2]).applyMatrix4(M); out.push(+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)); } } return out; };
      const Wt = at(worstT || +(process.env.MOTION_T || 1)), hitP = [];
      for (const [i, [, s2, x, y, z]] of pts.entries()) { v.set(x, y, z).applyMatrix4(Wt.get(s2)); const d = depthAt(v.x, v.y, v.z); if (d >= DEEP && base[i] < DEEP && ownAt(v.x, v.y, v.z) === 0) hitP.push(+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)); }
      fs.writeFileSync(process.env.MOTION_DUMP, JSON.stringify({ id: entry.id, part: p.key, t: worstT, body: tri(worldOf(sc, statePose), mine, false), shut: tri(W0, mine, true), moved: tri(Wt, mine, true), hits: hitP }));
    }
    const inside = `${worstN} of ${pts.length} points inside the body${worstN ? ` at ${worstT * 100}% open (up to ~${worstDeep * 5} mm in)` : " at 25/50/75/100%"}`;

    // the free edge: the points furthest from the hinge line (in the node's own frame), followed in the model's frame;
    // for the part's node and each node it moves with it (`also`)
    const dirs = [], dirBads = [];
    for (const [mi, mv] of ms.entries()) {
      const r0 = R[mi], tag = ms.length > 1 ? `${mv.node}: ` : "";
      const own0 = pts.filter((q) => q[0] === mi);
      let dir = "", dirBad = null;
      if (!kind) dirBad = `can't tell what kind of part "${p.key}" is (door, lid, louvre, panel or slide): name it so, or teach kindOf in parts_motion.mjs`;
      else if (mv.slide) {
        // the slide in the model's frame (the node's parent may be turned)
        const P = r0.parent ? rest.get(r0.parent) : new THREE.Matrix4();
        const s = new THREE.Vector3(...mv.slide).transformDirection(P).multiplyScalar(Math.hypot(...mv.slide));
        dir = `slides ${cm(s.z)} cm out${Math.abs(s.y) > 0.005 ? `, ${cm(Math.abs(s.y))} cm ${s.y > 0 ? "up" : "down"}` : ""}${Math.abs(s.x) > 0.005 ? `, ${cm(Math.abs(s.x))} cm ${s.x > 0 ? "right" : "left"}` : ""}`;
        if (s.z < DIR_MIN * 0.5) dirBad = `it slides ${s.z < 0 ? "back into the body" : "no way out"} (${cm(s.z)} cm along z; the front is +z)`;
      } else if (!own0.length) dirBad = "it has no surface to follow";
      else {
        // points in the hinge node's own frame, relative to its pivot (its origin), and their distance from the axis line
        const inv = W0.get(r0).clone().invert();
        const local = own0.map(([, s2, x, y, z]) => ({ l: new THREE.Vector3(x, y, z).applyMatrix4(W0.get(s2)).applyMatrix4(inv) }));
        const ax = AXES[mv.axis];
        const perp = local.map(({ l }) => l.clone().sub(ax.clone().multiplyScalar(l.dot(ax))));
        const dist = perp.map((q) => q.length());
        const far = dist.reduce((x, y) => Math.max(x, y), 0);
        // a vane turning on a pin through its middle has two far edges, one each side of the pin: follow the one that
        // starts furthest out front (its lip); a hinge at one edge has one
        const side = perp[dist.indexOf(far)].clone().normalize();
        const sides = [local.filter((_, i) => dist[i] >= 0.85 * far && perp[i].dot(side) >= 0), local.filter((_, i) => dist[i] >= 0.85 * far && perp[i].dot(side) < 0)];
        const centroid = (list, W) => { const c = new THREE.Vector3(); for (const e of list) c.add(e.l.clone().applyMatrix4(W.get(r0))); return c.divideScalar(Math.max(1, list.length)); };
        const edge = sides[1].length && centroid(sides[1], W0).z > centroid(sides[0], W0).z ? sides[1] : sides[0];
        // it must move: 2 cm, or a quarter of its reach for a part smaller than 8 cm (an 8 mm flap)
        const minMove = Math.min(DIR_MIN, 0.25 * far);
        const c0 = centroid(edge, W0);
        const moves = STEPS.map((t) => ({ t, d: centroid(edge, at(t)).sub(c0) }));
        const d1 = moves[moves.length - 1].d;
        const say = (d) => `${cm(Math.abs(d.z))} cm ${d.z >= 0 ? "out" : "back"}, ${cm(Math.abs(d.y))} cm ${d.y >= 0 ? "up" : "down"}`;
        dir = `free edge ${say(d1)}`;
        const worst = (f) => moves.find(({ d }) => f(d));
        if (kind === "door") {
          const w = worst((d) => d.z < -DIR_TOL);
          if (w) dirBad = `the door's free edge goes back into the cabinet (${cm(-w.d.z)} cm at ${w.t * 100}%)`;
          else if (d1.z < minMove) dirBad = `the door's free edge comes out only ${cm(d1.z)} cm`;
        } else if (kind === "lid") {
          const w = worst((d) => d.y < -DIR_TOL);
          if (w) dirBad = `the lid's free edge goes down into the body (${cm(-w.d.y)} cm at ${w.t * 100}%)`;
          else if (d1.y < minMove) dirBad = `the lid's free edge lifts only ${cm(d1.y)} cm`;
        } else if (kind === "panel") {
          const w = worst((d) => d.y < -DIR_TOL || d.z < -DIR_TOL);
          if (w) dirBad = `the front panel's free edge goes ${w.d.y < -DIR_TOL ? "down" : "back"} (${say(w.d)} at ${w.t * 100}%)`;
          else if (d1.y < minMove * 0.5 || d1.z < minMove * 0.5) dirBad = `the front panel doesn't lift up and out (${say(d1)})`;
        } else if (kind === "louvre") {
          const w = worst((d) => d.z < -DIR_TOL || d.y > DIR_TOL);
          if (w) dirBad = `the louvre's free edge goes ${w.d.z < -DIR_TOL ? "back" : "up"} into the outlet (${say(w.d)} at ${w.t * 100}%)`;
          else if (Math.hypot(d1.y, d1.z) < minMove) dirBad = `the louvre's free edge moves only ${cm(Math.hypot(d1.y, d1.z))} cm`;
        } else if (kind === "slide") dirBad = `${mv.node} turns, but its part slides`;
      }
      dirs.push(tag + dir);
      if (dirBad) dirBads.push(tag + dirBad);
    }
    const dir = dirs.join("; "), dirBad = dirBads.join("; ") || null;

    // waivers for b and c only, each with its reason and source
    const wv = own.motion?.[p.key];
    const waiverOk = wv && typeof wv.reason === "string" && wv.reason.trim().length > 10 && typeof wv.source === "string" && wv.source.trim().length > 5;
    if (wv && !waiverOk) notes.push(`a waiver in ${entry.id}.gate.json needs both "reason" and "source"; ignored`);
    const motionBad = [dirBad, intrudes ? `it goes into the body: ${inside}` : null].filter(Boolean);
    const waived = waiverOk && motionBad.length && !fails.length;
    const all = [...fails, ...(waived ? [] : motionBad)];
    const okLine = `matches ${clipsSeen ? "the GLB's clips" : "no clips"} and ${usdas.length} Apple file${usdas.length === 1 ? "" : "s"}; tap zones hold it; ${kind || "?"}: ${dir}; ${inside}`;
    results.push({
      part: p.key, kind, ok: !fails.length && !motionBad.length, waived: !!waived,
      detail: `${head}: ${all.length ? all.join(" | ") : okLine}${waived ? ` (waived: ${motionBad.join("; ")}: ${wv.reason} [${wv.source}])` : ""}${notes.length ? ` (${notes.join("; ")})` : ""}`,
      numbers: { kind, dir, frac: worstFrac, deep: worstDeep, n: worstN, pts: pts.length, glbBad: glbBad.length, usdBad: usdBad.length, zoneBad: zoneBad.length },
    });
  }
  return results;
}

// ── standalone: node pipeline/scripts/parts_motion.mjs [<id> ...|--all] [--products f] [--entry f] ──
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const productsFile = path.resolve(SITE, opt("--products") || "products.json"), entryFile = opt("--entry");
  const cat = JSON.parse(fs.readFileSync(productsFile, "utf8")).products;
  const ids = args.includes("--all") ? cat.filter((p) => !p.hidden).map((p) => p.id) : args.filter((a, i) => !a.startsWith("--") && !["--products", "--entry"].includes(args[i - 1]));
  if (!ids.length) { console.error("usage: node pipeline/scripts/parts_motion.mjs [<id> ...|--all] [--products f] [--entry f]"); process.exit(2); }
  const file = (p) => path.join(SITE, p.replace(/^\//, ""));
  let failed = 0;
  const table = [];
  for (const id of ids) {
    let entry = entryFile ? JSON.parse(fs.readFileSync(path.resolve(SITE, entryFile), "utf8")).products.find((p) => p.id === id) : cat.find((p) => p.id === id);
    if (!entry && fs.existsSync(`${SITE}/pipeline/entries/${id}.json`)) entry = JSON.parse(fs.readFileSync(`${SITE}/pipeline/entries/${id}.json`, "utf8")).products.find((p) => p.id === id);
    if (!entry) { console.log(`FAIL   ${id}: no entry`); failed++; continue; }
    const wall = entry.placement === "wall";
    const usdz = (entry.finishes || []).flatMap((f) => (wall ? [f.usdz] : [f.usdz, f.usdz.replace(/\.usdz$/, "-free.usdz")])).map(file).filter((f) => fs.existsSync(f));
    const ownF = `${SITE}/pipeline/entries/${id}.gate.json`;
    const own = fs.existsSync(ownF) ? JSON.parse(fs.readFileSync(ownF, "utf8")) : {};
    const t0 = Date.now();
    let res;
    try { res = await partsMotion({ entry, glbFile: file(entry.glb), usdzFiles: usdz, own }); }
    catch (e) { console.log(`FAIL   ${id}: ${e.message}`); failed++; continue; }
    console.log(`== ${id} (${entry.category}, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    for (const r of res) {
      const st = r.ok ? "PASS" : r.waived ? "WAIVED" : "FAIL";
      if (st === "FAIL") failed++;
      console.log(`${st.padEnd(6)} parts-motion   ${r.detail}`);
      table.push([id, r.part, st, r.numbers?.kind || "", r.numbers?.dir || "", r.numbers ? `${r.numbers.n}/${r.numbers.pts} ${(r.numbers.frac * 100).toFixed(2)}% d${r.numbers.deep}` : ""]);
    }
  }
  if (opt("--tsv")) fs.writeFileSync(opt("--tsv"), table.map((r) => r.join("\t")).join("\n") + "\n");
  console.log(`\n${failed} part${failed === 1 ? "" : "s"} failed in ${ids.length} product${ids.length === 1 ? "" : "s"}`);
  process.exit(failed ? 1 : 0);
}
