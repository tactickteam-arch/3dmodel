// Phone AR on Android, driven through the stand-in in xr_phone.js (not a real phone, not ARCore).
// What the shop needs: staff point the dot at a spot on the floor, Place here stands the product on
// exactly that spot, facing the phone, at real size; a finger dragging across it can't slide it away;
// Move to another spot puts it somewhere else, a tap on the camera view places it too; leaving AR gives
// the 3D view back. Wall units keep model-viewer's own placement on the wall, flat against it, at real size.
// And, for every product, inside AR:
//  - what a budget phone can hold: its textures once decoded, its triangles and its draw calls, within the budget
//    below (BUDGET), so a phone can't run out of memory and drop the page;
//  - its look: the same tone mapping, exposure and studio light as the 3D view until the phone sends the room's
//    light, kept as the 3D view keeps it (a turntable fixed to the viewer), so the side the phone sees is lit as
//    the 3D view lights that side, whichever way the product faces in the room; neither black nor burnt out next to
//    the 3D view seen from the same side; the studio light held until the room's reflections have come with its light;
//  - every moving part: its AR button and a tap on it open it and close it again, along the clip the 3D view plays,
//    to the same end pose as every viewer (parts_motion.mjs: the entry's angle or slide on the node's own pivot); a
//    part that sits behind another opens that one first; nothing else moves, and the product doesn't shift, turn or
//    change size on its spot while a part moves;
//  - a part left open in the 3D view (even mid-swing) is open in AR, as it was, and finishes its move;
//  - every colour: picked on the page or opened straight from its own link (/p/<item code>[/<colour>]), AR shows
//    that colour's materials; a colour picked inside AR changes the model and the address, and leaving AR keeps it;
//  - every AR button is on the screen and nothing covers it; no console errors, and nothing is left stuck after AR.
// usage: node test_arphone.mjs <baseUrl> <outDir> [product ids...]
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";
import { glbLoad } from "./glb_load.mjs";
import { finishPath, finishSlug } from "../../site.js";

// What a budget Android phone (about 4 GB of memory) can hold for one product, in Chrome's AR view.
//  - Texture memory: 256 MB once decoded, mipmaps included, every colour's images counted (glb_load.mjs). Of a
//    4 GB phone's memory, Android, Chrome and ARCore's camera and tracking leave roughly 0.5-1 GB to the page, and
//    three.js keeps each decoded image as well as its GPU copy, so a texture costs about twice its GPU size: 256 MB
//    is about 450 MB of the phone's memory. The largest product on 28 Nov 2026 used 187 MB.
//  - Largest image side: 4096 px. three.js shrinks a larger image to what the GPU allows; 4096 is the smallest limit
//    among phones ARCore supports (PowerVR GE8320), and 4096 was the largest side in use on 28 Nov 2026.
//  - Triangles: 100,000, Google's recommended limit for a model in Android's AR viewer (Scene Viewer, "3D model
//    requirements", developers.google.com/ar/develop/scene-viewer), on the same phones. Largest in use: 52,518.
//  - Draw calls: 1,000 a frame. Meta gives 500-1,000 a frame for its Quest headsets (developers.meta.com, Unity
//    performance guide), whose phone chip draws 72 frames a second; phone AR draws 30, so a slower phone chip has
//    more than twice the time per frame. Largest in use: 788 (a fridge with its stock, which AR shows).
const BUDGET = { textureMB: 256, side: 4096, triangles: 100000, drawCalls: 1000 };
// A plain grey room's light, as the stand-in sends it when asked (xr_phone.js): a soft light from above and a little
// behind the phone, and a flat grey reflection picture. Made up for the test, not measured: it shows only that the page
// switches to the room's light cleanly, not how a real room looks.
const ROOM = { on: false, sh: [0.9, 0.88, 0.85, 0, 0, 0, 0.3, 0.3, 0.28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], dir: [0.3, 0.9, 0.3], intensity: [1.5, 1.45, 1.4], reflection: [150, 146, 140] };

const [base, out, ...args] = process.argv.slice(2);
const catalogue = (await (await fetch(`${base}/products.json`)).json()).products;
const ids = args.length ? args : catalogue.filter((p) => !p.hidden).map((p) => p.id);
fs.mkdirSync(out, { recursive: true });
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const W = 412, H = 915;
let failed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failed++; return ok; };
const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9481) });
await b.viewport(W, H, true, ANDROID);
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: fs.readFileSync(new URL("./xr_phone.js", import.meta.url), "utf8") });

// where the product stands: the middle of its footprint, at the bottom of its box, in the AR world
const STAND = `(() => {
  const mv = document.querySelector('model-viewer');
  const sym = (o, n) => { for (; o; o = Object.getPrototypeOf(o)) { const s = Object.getOwnPropertySymbols(o).find((x) => x.description === n); if (s) return s; } };
  const scene = mv[sym(mv, 'scene')], R = mv[sym(mv, 'renderer')].arRenderer, bb = scene.boundingBox;
  scene.updateMatrixWorld(true);
  const c = bb.getCenter(scene.pivot.position.clone()); c.y = bb.min.y;
  const w = scene.target.localToWorld(c);
  const q = scene.pivot.quaternion, yaw = 2 * Math.atan2(q.y, q.w); // its turn about the vertical (its Euler y is wrong past 90 degrees)
  return JSON.stringify({ at: [w.x, w.y, w.z], goal: [R.goalPosition.x, R.goalPosition.y, R.goalPosition.z], yaw, scale: scene.pivot.scale.x,
    shown: scene.model.visible, mode: mv.getAttribute('ar-status'), ui: document.getElementById('arUi').className,
    place: document.getElementById('arPlace').disabled ? 'disabled' : 'enabled', status: document.getElementById('arStatus').textContent,
    phone: window.__phone.state.pos });
})()`;

// Helpers inside the page (window.__t), added after each load. They read model-viewer 4.0.0's scene through its
// symbols, as product.html does, and the GLB's own nodes and materials through model-viewer's record of the file.
const HELP = `window.__t = (() => {
  const mv = document.querySelector('model-viewer');
  const sym = (o, n) => { for (; o; o = Object.getPrototypeOf(o)) { const s = Object.getOwnPropertySymbols(o).find((x) => x.description === n); if (s) return s; } };
  const S = () => mv[sym(mv, 'scene')], RR = () => mv[sym(mv, 'renderer')];
  const product = window.__demo.product, parts = product.parts || [];
  const needsOf = (p) => [].concat(p?.needs || []);
  const movers = (p) => [{ node: p.node, axis: p.axis, angle: p.angle, slide: p.slide }, ...(p.also || []).map((a) => ({ node: a.node, axis: a.axis || p.axis, angle: a.angle, slide: a.slide }))];
  const gltf = () => S().currentGLTF.correlatedSceneGraph;
  const inModel = (o) => { for (let x = o; x; x = x.parent) if (x === S().model) return true; return false; };
  let named = null;
  const nodes = () => {
    if (named) return named;
    named = new Map();
    const g = gltf();
    for (const [o, v] of g.threeObjectMap) if (o.isObject3D && v.nodes != null && inModel(o)) { const n = g.gltf.nodes[v.nodes]; named.set(n.name, [...(named.get(n.name) || []), { o, n }]); }
    return named;
  };
  const AX = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  const want = (m, n, open) => {
    const Q = S().pivot.quaternion.constructor, V = S().pivot.position.constructor;
    const q = new Q(...(n.rotation || [0, 0, 0, 1])), t = new V(...(n.translation || [0, 0, 0]));
    if (open) { if (m.slide) t.add(new V(...m.slide)); else q.multiply(new Q().setFromAxisAngle(new V(...AX[m.axis]), m.angle * Math.PI / 180)); }
    return { q, t };
  };
  const moverObjects = () => new Set(parts.flatMap((p) => movers(p).flatMap((m) => (nodes().get(m.node) || []).map((x) => x.o))));
  let snap = null, watch = null;
  const trs = (o) => [...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()];
  const pinNow = () => { const s = S(); s.target.updateMatrixWorld(true); return Array.from(s.target.matrixWorld.elements); };
  const onFrame = () => {
    if (!watch) return;
    const e = pinNow();
    for (let i = 0; i < 16; i++) watch.worst = Math.max(watch.worst, Math.abs(e[i] - watch.base[i]));
    watch.scale = Math.max(watch.scale, Math.abs(S().pivot.scale.x - 1));
    watch.frames++;
  };
  mv.addEventListener('camera-change', onFrame);
  return {
    // how far each part is from the pose its state (or st) gives it: the worst angle in degrees and offset in mm
    poses(st = window.__demo.state) {
      return parts.map((p) => {
        let a = 0, d = 0; const missing = [];
        for (const m of movers(p)) {
          const hit = nodes().get(m.node);
          if (!hit || hit.length !== 1) { missing.push(m.node); continue; }
          const { o, n } = hit[0], w = want(m, n, !!st[p.key]);
          a = Math.max(a, o.quaternion.angleTo(w.q) * 180 / Math.PI); d = Math.max(d, o.position.distanceTo(w.t) * 1000);
        }
        return { key: p.key, a, d, missing };
      });
    },
    // remember every node's own position, turn and size, then list those that changed and aren't a moving part
    snap() { snap = new Map(); S().model.traverse((o) => snap.set(o, trs(o))); },
    moved() {
      const ok = moverObjects(), out = [];
      S().model.traverse((o) => { const s = snap.get(o); if (!s || ok.has(o)) return; if (trs(o).some((v, i) => Math.abs(v - s[i]) > 1e-4)) out.push(o.name || o.type); });
      return out;
    },
    // the product on its spot: watch the model's whole placement on every AR frame while a part moves
    watch() { watch = { base: pinNow(), worst: 0, scale: 0, frames: 0 }; },
    unwatch() { const w = watch; watch = null; return w; },
    peek() { return watch ? watch.frames : 0; },
    render() { if (!RR().arRenderer.isPresenting) S().queueRender(); },
    // light.js's studio light is in (its key light hangs on the model's target); it loads after the model, from the CDN
    lit() { return S().target.children.some((o) => o.isDirectionalLight); },
    // a spot on the screen that the page's own tap code (positionAndNormalFromPoint + partAt) reads as this part
    async tapSpot(key) {
      const { partAt } = await import('/site.js');
      const p = parts.find((x) => x.key === key), st = { ...window.__demo.state }, z = p.zone?.[st[key] ? 'open' : 'closed'];
      if (!z) return null;
      const s = S(), V = s.pivot.position.constructor;
      s.updateMatrixWorld(true);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      // where to look: the part's tap zone and the part itself, as it stands now (a lifted filter's zone is only its top,
      // which a phone level with it sees edge on; its front, a few cm below, is what a finger lands on)
      const bb = new (s.boundingBox.constructor)();
      for (const m of movers(p)) for (const { o } of nodes().get(m.node) || []) bb.expandByObject(o);
      const corners = [];
      for (let i = 0; i < 8; i++) corners.push(s.target.localToWorld(new V(z[i & 1][0], z[(i >> 1) & 1][1], z[(i >> 2) & 1][2])));
      if (!bb.isEmpty()) for (let i = 0; i < 8; i++) corners.push(new V(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z));
      for (const v of corners) {
        const sp = window.__phone.project([v.x, v.y, v.z]);
        if (!sp) continue;
        const X = (sp[0] + 1) / 2 * innerWidth, Y = (sp[1] + 1) / 2 * innerHeight;
        x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
      }
      x0 = Math.max(x0, 6); y0 = Math.max(y0, 6); x1 = Math.min(x1, innerWidth - 6); y1 = Math.min(y1, innerHeight - 6);
      if (!(x1 > x0 && y1 > y0)) return null;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, spots = [];
      // (every 2 px down: a lifted filter's top is a strip a few pixels high from in front)
      const nx = 10, ny = Math.max(10, Math.ceil((y1 - y0) / 2));
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) spots.push([x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny]);
      spots.sort((a, c) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(c[0] - cx, c[1] - cy));
      for (const [x, y] of spots) {
        if (document.elementFromPoint(x, y) !== mv) continue; // a button or the status is over it
        const h = mv.positionAndNormalFromPoint(x, y);
        if (h && partAt(product, st, h.position) === key) return [Math.round(x), Math.round(y)];
      }
      return null;
    },
    // every mesh's material against the GLB's for this colour (KHR_materials_variants), and against the 3D view's
    colour(variant) {
      const g = gltf().gltf, vs = g.extensions?.KHR_materials_variants?.variants || [], vi = vs.findIndex((v) => v.name === variant);
      const bad = [];
      let n = 0;
      S().model.traverse((o) => {
        const a = o.isMesh && o.userData.associations;
        if (!a || a.meshes == null) return;
        const pr = g.meshes[a.meshes].primitives[a.primitives];
        const map = pr.extensions?.KHR_materials_variants?.mappings?.find((m) => m.variants.includes(vi));
        const idx = map ? map.material : pr.material;
        if (idx == null) return;
        n++;
        if (o.material.name !== g.materials[idx].name) bad.push(o.name + ': ' + o.material.name + ' for ' + g.materials[idx].name);
      });
      return { n, bad: bad.length, first: bad.slice(0, 2), variant: mv.variantName };
    },
    materials() { const m = {}; S().model.traverse((o) => { if (o.isMesh) m[o.uuid] = o.material.uuid; }); return m; },
    // the light and the look: renderer state, and the product's pixels on the canvas (opaque ones only)
    look() {
      const s = S(), T = RR().threeRenderer, c = T.domElement, t = document.createElement('canvas');
      t.width = c.width >> 2; t.height = c.height >> 2;
      const g = t.getContext('2d'); g.drawImage(c, 0, 0, t.width, t.height);
      const d = g.getImageData(0, 0, t.width, t.height).data;
      let n = 0, sum = 0, dark = 0, hot = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 250) continue;
        n++;
        const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
        sum += l; if (l < 0.04) dark++; if (d[i] > 250 && d[i + 1] > 250 && d[i + 2] > 250) hot++;
      }
      const q = s.pivot.quaternion, eye = s.getCamera().position, at = s.pivot.position, yaw = 2 * Math.atan2(q.y, q.w);
      return { toneMapping: T.toneMapping, exposure: T.toneMappingExposure, colorSpace: T.outputColorSpace, env: s.environment?.uuid || null,
        envIntensity: s.environmentIntensity, envTurn: s.environmentRotation.y, yaw, side: Math.atan2(eye.x - at.x, eye.z - at.z) - yaw, estimate: !!RR().arRenderer.xrLight?.parent,
        pixels: n, mean: n ? sum / n : 0, dark: n ? dark / n : 0, hot: n ? hot / n : 0,
        calls: T.info.render.calls, triangles: T.info.render.triangles };
    },
    // every AR button showing: on the screen, and the top thing where a finger presses it
    buttons() {
      const ui = document.getElementById('arUi'), bad = [];
      let n = 0;
      for (const el of ui.querySelectorAll('button')) {
        const r = el.getBoundingClientRect();
        if (!r.width || getComputedStyle(el).display === 'none' || el.closest('.hide')) continue;
        n++;
        const name = el.id || el.getAttribute('aria-label') || el.textContent;
        if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) { bad.push(name + ' off the screen'); continue; }
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (top !== el && !el.contains(top)) bad.push(name + ' covered');
      }
      return { n, bad };
    },
    centre(id) { const r = document.getElementById(id).getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; },
    stuck() {
      const out = [];
      if (!document.getElementById('arUi').classList.contains('hide')) out.push('the AR buttons still show');
      if (document.documentElement.classList.contains('xr-overlay')) out.push('the page is still in AR overlay');
      if (!document.getElementById('sheet').classList.contains('hide')) out.push('the AR guide is still open');
      if (!window.__demo.idle()) out.push('a part is still busy');
      if (mv.getAttribute('ar-status') !== 'not-presenting') out.push('ar-status ' + mv.getAttribute('ar-status'));
      if (!S().model.visible) out.push('the model is hidden');
      return out;
    },
  };
})(); true`;

const stand = async (ms = 900) => { await sleep(ms); return JSON.parse(await b.evalJS(STAND)); };
// polls until ok(s) or the time is up: AR frames come slowly on a busy machine
const standUntil = async (ok, ms = 5000) => { const end = Date.now() + ms; let s; do { s = await stand(150); } while (!ok(s) && Date.now() < end); return s; };
const until = async (expr, ms = 10000) => { const end = Date.now() + ms; let v; do { v = await b.evalJS(expr); if (v && !v.__error) return v; await sleep(150); } while (Date.now() < end); return v; };
const js = async (expr) => { const v = await b.evalJS(expr); if (v && v.__error) throw new Error(v.__error); return typeof v === "string" && /^[[{]/.test(v) ? JSON.parse(v) : v; };
// the canvas is read between two frames now and then, and comes back empty (the screenshot right after shows the
// product) or a frame behind: ask for a frame and read it two frames on, and again a little later if it is empty, before judging the look
const LOOK = "(async () => { window.__t.render(); await Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), new Promise((r) => setTimeout(r, 300))]); return JSON.stringify(window.__t.look()); })()";
const lookNow = async () => { let l; for (let i = 0; i < 10; i++) { l = await js(LOOK); if (l.pixels) break; await sleep(100); } return l; };
const dist = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
const fmt = (p) => `(${p.map((v) => v.toFixed(3)).join(", ")})`;
const aim = (from, to) => b.evalJS(`window.__phone.aim(${JSON.stringify(from)}, ${JSON.stringify(to)})`);
const facing = (s) => { const want = Math.atan2(s.phone[0] - s.at[0], s.phone[2] - s.at[2]); let d = s.yaw - want; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) * 180 / Math.PI; };
const tap = async (x, y, xr = true) => {
  // a finger on the screen: Chrome sends the AR scene a touch (a WebXR select) and the page a pointer press
  if (xr) await b.evalJS(`window.__phone.touchStart(${x / W * 2 - 1}, ${y / H * 2 - 1})`);
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await sleep(60);
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  if (xr) await b.evalJS("window.__phone.touchEnd()");
};
const pressButton = async (id) => { const [x, y] = await js(`JSON.stringify(window.__t.centre(${JSON.stringify(id)}))`); await tap(x, y, false); };
const enterAR = async () => {
  await b.evalJS("document.getElementById('btnAR').click()");
  await sleep(500);
  if (await b.evalJS("!document.getElementById('sheet').classList.contains('hide')")) await b.evalJS("document.getElementById('sheetGo').click()");
  return b.waitFor("document.querySelector('model-viewer').getAttribute('ar-status') === 'session-started'", 10000);
};
const leaveAR = async () => {
  await b.evalJS("document.querySelector('model-viewer').shadowRoot.querySelector('.slot.exit-webxr-ar-button').click()");
  return b.waitFor("document.querySelector('model-viewer').getAttribute('ar-status') === 'not-presenting'", 5000);
};
const load = async (path) => {
  b.logs.length = 0;
  await b.go(`${base}${path}`);
  const ok = await b.waitFor("document.querySelector('model-viewer')?.loaded === true && !!window.__demo", 90000);
  if (ok) await js(HELP);
  return ok;
};
const idle = () => b.waitFor("window.__demo.idle()", 15000);
// floor products: point at a spot, wait for the footprint, Place here
const placeOnFloor = async (spot, from = [0, 0, 0]) => {
  await aim(from, spot);
  await b.evalJS("window.__phone.state.floorFound = true");
  const C = await b.evalJS("window.__phone.centreHit()");
  await standUntil((s) => s.place === "enabled" && dist(s.goal, C) < 0.002, 8000);
  await pressButton("arPlace");
  return standUntil((s) => s.shown && dist(s.at, C) < 0.001, 5000);
};
// wall units: point at the wall; model-viewer stands the unit's back on it where the phone points
const WALL = -2.2;
const placeOnWall = async () => {
  await b.evalJS(`window.__phone.state.wall = ${WALL}`);
  await aim([0, 0, 0], [0.15, 0.55, WALL]);
  await b.evalJS("window.__phone.state.floorFound = true");
  const placed = await b.waitFor("document.querySelector('model-viewer').getAttribute('ar-status') === 'object-placed'", 10000);
  // it glides onto the spot
  await until(`(() => { const s = document.querySelector('model-viewer'); const sym = (o, n) => { for (; o; o = Object.getPrototypeOf(o)) { const x = Object.getOwnPropertySymbols(o).find((y) => y.description === n); if (x) return x; } };
    const R = s[sym(s, 'renderer')].arRenderer; return R.presentedScene && R.presentedScene.pivot.position.distanceTo(R.goalPosition) < 1e-5; })()`, 8000);
  await sleep(400);
  return placed;
};
// the phone held at eye height about 2.4 m in front of the product, looking at it; hit spot in the AR world, facing the phone
const lookAt = async (dist = 2.4, side = 0, up = 0) => {
  const g = await js(`JSON.stringify((() => { const mv = document.querySelector('model-viewer'); const sym = (o, n) => { for (; o; o = Object.getPrototypeOf(o)) { const x = Object.getOwnPropertySymbols(o).find((y) => y.description === n); if (x) return x; } };
    const s = mv[sym(mv, 'scene')], bb = s.boundingBox; s.updateMatrixWorld(true);
    const c = s.target.localToWorld(bb.getCenter(s.pivot.position.clone())); const q = s.pivot.quaternion;
    return { c: [c.x, c.y, c.z], yaw: 2 * Math.atan2(q.y, q.w), h: bb.max.y - bb.min.y }; })())`);
  const a = g.yaw + side;
  const from = [g.c[0] + Math.sin(a) * dist, Math.max(0, g.c[1] + 0.25) + up, g.c[2] + Math.cos(a) * dist];
  await aim(from, g.c);
  await sleep(600);
};

// ── the parts, inside AR: each by its button and by a tap, open and shut, nothing else moving, the product held ──
const bits = (parts, open) => parts.map((p) => (open.has(p.key) ? 1 : 0)).join("");
const closureOf = (parts, key, seen = new Set()) => { for (const k of [].concat(parts.find((x) => x.key === key)?.needs || [])) if (!seen.has(k)) { seen.add(k); closureOf(parts, k, seen); } return seen; };
const labelOf = (p, open) => (p.text ? p.text[open ? 1 : 0] : `${open ? "Close" : "Open"} ${p.label}`);
async function settledTo(parts, open, how, clip) {
  await idle();
  await sleep(250);
  const st = await js("JSON.stringify(window.__demo.state)");
  // a part that had already stopped (one opened in the 3D view) draws no AR frame of its own: the hand holding the
  // phone moves a little, as a real one does, so the spot is still seen held over some frames
  if (!(await b.evalJS("window.__t.peek()"))) {
    await b.evalJS("window.__phone.state.pos[0] += 0.002"); await sleep(300);
    await b.evalJS("window.__phone.state.pos[0] -= 0.002"); await sleep(300);
  }
  const poses = await js("JSON.stringify(window.__t.poses())");
  const w = await js("JSON.stringify(window.__t.unwatch())");
  const moved = await js("JSON.stringify(window.__t.moved())");
  const name = await b.evalJS("document.querySelector('model-viewer').animationName");
  const btns = await js(`JSON.stringify(${JSON.stringify(parts.map((p) => p.key))}.map((k) => { const e = document.getElementById('ar-' + k); return [e.textContent, e.getAttribute('aria-pressed')]; }))`);
  const wrongState = parts.filter((p) => !!st[p.key] !== open.has(p.key)).map((p) => p.key);
  const off = poses.filter((p) => p.missing.length || p.a > 0.5 || p.d > 2);
  const badBtn = parts.filter((p, i) => btns[i][0] !== labelOf(p, open.has(p.key)) || btns[i][1] !== String(open.has(p.key))).map((p) => p.key);
  const ok = !wrongState.length && !off.length && !moved.length && w && w.frames > 0 && w.worst < 0.0005 && w.scale === 0 && (!clip || name === clip) && !badBtn.length;
  check(ok, `${how}: ${open.size ? [...open].join(" + ") + " open" : "all shut"}` +
    (wrongState.length ? `; the page says otherwise for ${wrongState.join(", ")}` : "") +
    (off.length ? `; not at its pose: ${off.map((p) => p.missing.length ? `${p.key} (no node ${p.missing.join(", ")})` : `${p.key} ${p.a.toFixed(1)} degrees / ${p.d.toFixed(1)} mm off`).join(", ")}` : "") +
    (moved.length ? `; other things moved: ${moved.slice(0, 4).join(", ")}${moved.length > 4 ? ` and ${moved.length - 4} more` : ""}` : "") +
    (!w || !w.frames ? "; no AR frames seen while it moved" : w.worst >= 0.0005 || w.scale ? `; the product shifted ${(w.worst * 1000).toFixed(2)} mm / scale ${(1 + w.scale).toFixed(4)} on its spot` : "") +
    (clip && name !== clip ? `; clip ${name}, wanted ${clip}` : "") +
    (badBtn.length ? `; button words wrong for ${badBtn.join(", ")}` : "") +
    (ok ? ` (clip ${name}, ${w.frames} frames held on the spot, nothing else moved)` : ""));
  await js("window.__t.snap(); window.__t.watch(); true");
  return ok;
}
async function partsInAR(product) {
  const parts = product.parts || [];
  if (!parts.length) return;
  const ui = await js("JSON.stringify(window.__t.buttons())");
  check(!ui.bad.length && ui.n >= parts.length, `every AR button is on the screen and uncovered (${ui.n}${ui.bad.length ? `; ${ui.bad.join(", ")}` : ""})`);
  for (const p of parts) {
    const need = closureOf(parts, p.key), withP = new Set([...need, p.key]);
    await js("window.__t.snap(); window.__t.watch(); true");
    await pressButton(`ar-${p.key}`);
    await settledTo(parts, withP, `button "${labelOf(p, false)}"`, `S${bits(parts, need)}_${bits(parts, withP)}`);
    await pressButton(`ar-${p.key}`);
    await settledTo(parts, need, `button "${labelOf(p, true)}"`, `S${bits(parts, withP)}_${bits(parts, need)}`);
    // a tap on the part itself, from wherever a shopper standing in front can see it
    let found = false;
    const VIEWS = [[2.4, 0, 0], [1.5, 0, 0.2], [1.6, 0.6, 0], [1.6, -0.6, 0], [1.2, 0, -0.5]];
    for (const [d, side, up] of VIEWS) {
      await lookAt(d, side, up);
      const spot = JSON.parse(await b.evalJS(`window.__t.tapSpot(${JSON.stringify(p.key)}).then((s) => JSON.stringify(s))`));
      if (!spot) continue;
      found = true;
      await tap(...spot);
      await settledTo(parts, withP, `a tap on the ${p.label} at (${spot.join(", ")})`, `S${bits(parts, need)}_${bits(parts, withP)}`);
      // the same place first; a part that opens out of sight from there (a filter lifted level with the phone shows only
      // its edge) from wherever in front it shows. (No spot comes back as JSON null, which must count as none.)
      const spotNow = async () => JSON.parse(await b.evalJS(`window.__t.tapSpot(${JSON.stringify(p.key)}).then((s) => JSON.stringify(s))`));
      let back = await spotNow(), where = "from the same place";
      for (const [d2, side2, up2] of VIEWS) {
        if (back) break;
        await lookAt(d2, side2, up2);
        back = await spotNow();
        where = `from ${d2} m off, ${side2} m to the side, ${up2} m up`;
      }
      if (!check(!!back, `the open ${p.label} can be tapped shut ${back ? where : "(no spot on the screen that the page reads as it, from 5 places in front)"}`)) break;
      await sleep(650);
      await tap(...back);
      await settledTo(parts, need, `a tap on the open ${p.label}`, `S${bits(parts, withP)}_${bits(parts, need)}`);
      break;
    }
    if (!found) check(false, `a tap on the ${p.label} opens it (no spot on the screen that the page reads as it, from 5 places in front)`);
    // shut what it needed, outermost last
    for (const k of [...need].reverse()) {
      const st = await js("JSON.stringify(window.__demo.state)");
      if (st[k]) { await pressButton(`ar-${k}`); await idle(); }
    }
    await idle();
    await lookAt();
  }
  const st = await js("JSON.stringify(window.__demo.state)");
  check(Object.values(st).every((v) => !v), "every part is shut again");
}

// ── the look ──
let look3d = null, home = 0;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function lookCheck(l, where) {
  const same = l.toneMapping === look3d.toneMapping && Math.abs(l.exposure - look3d.exposure) < 1e-6 && l.colorSpace === look3d.colorSpace;
  check(same, `${where}: tone mapping ${l.toneMapping}, exposure ${l.exposure}, ${l.colorSpace}, as in the 3D view (${look3d.toneMapping}, ${look3d.exposure}, ${look3d.colorSpace})`);
  // the studio light as the 3D view keeps it: a turntable fixed to the viewer, so the side the phone sees (here its
  // front) gets the light the 3D view gives that side, however the product is turned in the room
  const off = wrap(l.envTurn - l.yaw - (l.side - home)), deg = (a) => (a * 180 / Math.PI).toFixed(0);
  check(!l.estimate && l.env === look3d.env && Math.abs(off) < 0.01 && Math.abs(l.side) < 0.02 && Math.abs(l.envIntensity - look3d.envIntensity) < 1e-3,
    `${where}: no room light yet, so the 3D view's studio light, as the 3D view gives it from the same side (product turned ${deg(l.yaw)} degrees, seen from ${deg(l.side)} degrees round, light ${deg(wrap(l.envTurn - l.yaw))} degrees from the product, the 3D view's ${deg(wrap(l.side - home))}; strength ${l.envIntensity.toFixed(3)}, 3D ${look3d.envIntensity.toFixed(3)})`);
  later.push({ l, where, how: "neither black nor burnt out", band: [0.7, 1.4], slack: 0.03 });
}
// The pixels are judged once AR is over, against the 3D view seen from the same place, through a lens set so the
// product covers as many pixels as it did in AR: fine lines on a black door blur into their neighbours at a smaller
// size, and a third fewer near-black pixels there meant nothing (28 Nov)
let later = [];
async function view3dLook(wall, fov) {
  const was = await b.evalJS(`(() => { const mv = document.querySelector('model-viewer'), c = mv.getBoundingBoxCenter(), F = window.__phone.floor;
    const cy = ${wall} ? 0.55 : F + mv.getDimensions().y / 2, up = Math.max(0, cy + 0.25) - cy;
    const was = [mv.getCameraOrbit().toString(), mv.getCameraTarget().toString(), mv.fieldOfView, mv.minFieldOfView, mv.maxFieldOfView, mv.maxCameraOrbit, mv.style.cssText];
    mv.style.cssText += ';position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:99999';
    mv.minFieldOfView = '1deg'; mv.maxFieldOfView = '120deg'; mv.fieldOfView = '${fov}deg'; mv.maxCameraOrbit = 'Infinity 180deg 100m';
    mv.cameraTarget = c.x + 'm ' + c.y + 'm ' + c.z + 'm'; mv.cameraOrbit = '0rad ' + (Math.PI / 2 - Math.atan2(up, 2.4)) + 'rad ' + Math.hypot(up, 2.4) + 'm'; mv.jumpCameraToGoal(); return JSON.stringify(was); })()`);
  await sleep(800);
  const l = await lookNow();
  await b.evalJS(`(() => { const mv = document.querySelector('model-viewer'), [o, t, f, nf, mf, mo, css] = ${was}; mv.style.cssText = css; mv.maxCameraOrbit = mo; mv.minFieldOfView = nf; mv.maxFieldOfView = mf; mv.fieldOfView = f; mv.cameraOrbit = o; mv.cameraTarget = t; mv.jumpCameraToGoal(); })()`);
  await sleep(500);
  return l;
}
async function judgeLater(wall) {
  if (!later.length) return;
  const want = later[0].l.pixels;
  let fov = 62, l3 = null;
  for (let i = 0; i < 4; i++) {
    l3 = await view3dLook(wall, fov);
    if (!l3.pixels || Math.abs(l3.pixels / want - 1) < 0.03) break;
    fov = 2 * Math.atan(Math.tan(fov * Math.PI / 360) * Math.sqrt(l3.pixels / want)) * 180 / Math.PI;
  }
  for (const { l, where, how, band, slack } of later) {
    const ratio = l.mean / l3.mean;
    check(l.pixels > 500 && ratio > band[0] && ratio < band[1] && l.dark <= l3.dark + slack && l.hot <= l3.hot + slack,
      `${where}: ${how}: brightness ${l.mean.toFixed(2)} vs ${l3.mean.toFixed(2)} in the 3D view from the same place (${l.pixels} vs ${l3.pixels} pixels of it), ${(l.dark * 100).toFixed(1)} % near black (3D ${(l3.dark * 100).toFixed(1)} %), ${(l.hot * 100).toFixed(1)} % white (3D ${(l3.hot * 100).toFixed(1)} %)`);
  }
  later = [];
}

for (const id of ids) {
  console.log(`\n[${id}]`);
  const product = catalogue.find((p) => p.id === id);
  const parts = product.parts || [];
  // ── what the phone has to hold ──
  try {
    const g = glbLoad(Buffer.from(await (await fetch(`${base}${product.glb}`)).arrayBuffer()));
    const mb = g.textureBytes / 2 ** 20, side = Math.max(0, ...g.images.filter((i) => i.size).map((i) => Math.max(...i.size)));
    check(!g.unsized.length && mb <= BUDGET.textureMB && side <= BUDGET.side, `textures: ${mb.toFixed(0)} MB once decoded (budget ${BUDGET.textureMB}), ${g.images.length} images, largest side ${side} px (budget ${BUDGET.side})${g.unsized.length ? `; can't read ${g.unsized.join(", ")}` : ""}`);
    check(g.triangles <= BUDGET.triangles, `triangles: ${g.triangles} (budget ${BUDGET.triangles})`);
    check(g.drawCalls <= BUDGET.drawCalls, `draw calls: ${g.drawCalls} with everything shown (budget ${BUDGET.drawCalls})`);
  } catch (e) { check(false, `the model can be read for its size on a phone (${e.message})`); }

  if (!check(await load(`/p/${id}`), "the page loads")) continue;
  await sleep(1500);
  const info = JSON.parse(await b.evalJS(`JSON.stringify({ wall: window.__demo.product.placement === 'wall', can: document.querySelector('model-viewer').canActivateAR,
    dims: (() => { const d = document.querySelector('model-viewer').getDimensions(); return [d.x, d.y, d.z]; })() })`));
  check(info.can, "Android Chrome with WebXR gets the in-browser AR view");
  // the 3D view seen from where the AR checks look from (lookAt): straight in front, 2.4 m off, from the phone's
  // height (a hand's height or more: 0.25 m above its middle, at least 1.35 m off the floor; a wall unit hangs with
  // its middle where the phone points, 0.55 m above that), through the stand-in phone's lens (62 degrees top to bottom),
  // on the whole screen as AR is
  home = parseFloat(product.orbit) * Math.PI / 180;
  later = [];
  // (the studio light takes its opening view from the camera when it comes in, so let it come in first)
  check(await until("window.__t.lit()", 20000) === true, "the 3D view's studio light is in");
  look3d = await view3dLook(info.wall, 62);
  const nodesOk = await js("JSON.stringify(window.__t.poses({}).filter((p) => p.missing.length).map((p) => p.key))");
  check(!nodesOk.length, `every part's node is in the AR scene once${nodesOk.length ? `: not for ${nodesOk.join(", ")}` : ""}`);
  // zoom the 3D view onto one spot first: AR must still stand it by its middle
  await b.evalJS("(() => { const mv = document.querySelector('model-viewer'), d = mv.getDimensions(), c = mv.getBoundingBoxCenter(); mv.cameraTarget = `${c.x + d.x * 0.4}m ${c.y + d.y * 0.3}m ${c.z + d.z / 2}m`; mv.jumpCameraToGoal(); })()");
  await sleep(400);

  // a part left opening in the 3D view as AR starts: it is open in AR, as it was, all the way
  const first = parts.find((p) => !p.needs);
  if (first) await b.evalJS(`document.getElementById('part-${first.key}').click()`);

  const F = await b.evalJS("window.__phone.floor");
  const eye = [0, 0, 0];
  await b.evalJS("window.__phone.state.floorFound = false");
  await aim(eye, info.wall ? [0.15, 0.55, WALL] : [0.3, F, -1.6]);
  const started = await enterAR();
  check(started, "AR starts");
  if (!started) continue;

  if (info.wall) {
    let s = await stand(800);
    check(!/aiming|placed/.test(s.ui) && /wall/.test(s.status), `a wall unit keeps the wall placement ("${s.status}")`);
    const placed = await placeOnWall();
    s = await stand(300);
    const g = await js(`JSON.stringify((() => { const mv = document.querySelector('model-viewer'); const sym = (o, n) => { for (; o; o = Object.getPrototypeOf(o)) { const x = Object.getOwnPropertySymbols(o).find((y) => y.description === n); if (x) return x; } };
      const sc = mv[sym(mv, 'scene')], bb = sc.boundingBox, R = mv[sym(mv, 'renderer')].arRenderer; sc.updateMatrixWorld(true);
      const back = bb.getCenter(sc.pivot.position.clone()); back.z = bb.min.z; const w = sc.target.localToWorld(back);
      const box = new (bb.constructor)().setFromObject(sc.model), sz = box.getSize(sc.pivot.position.clone()), e = new (sc.pivot.rotation.constructor)().setFromQuaternion(sc.pivot.quaternion);
      const d = mv.getDimensions();
      return { back: [w.x, w.y, w.z], scale: sc.pivot.scale.x, world: [sz.x, sz.y, sz.z], model: [d.x, d.y, d.z], rot: [e.x, e.y, e.z], hit: [R.goalPosition.x, R.goalPosition.y, R.goalPosition.z] }; })())`);
    const hit = await b.evalJS("window.__phone.centreHit()");
    check(placed && Math.abs(g.back[2] - WALL) < 0.002 && dist(g.back, hit) < 0.003,
      `it hangs with its back flat on the wall where the phone points: back ${fmt(g.back)}, pointed at ${fmt(hit)} (${(dist(g.back, hit) * 1000).toFixed(1)} mm)`);
    check(g.rot.every((r) => Math.abs(r) < 0.0175), `it faces out of the wall, level (turned ${g.rot.map((r) => (r * 180 / Math.PI).toFixed(1)).join(", ")} degrees)`);
    check(/placed/.test(s.mode) && s.status.includes(product.arTip) && /along the wall/.test(s.status) && !/twist|turn/i.test(s.status),
      `the words say what works on a wall ("${s.status.replace(/\n/g, " / ")}")`);
    if (first) {
      await idle();
      check(await b.evalJS(`window.__demo.state['${first.key}'] === true`), `the ${first.label} opened in the 3D view is still open in AR`);
      await js("window.__t.snap(); window.__t.watch(); true");
      await settledTo(parts, new Set([first.key]), "as it was in the 3D view, all the way", null);
      await pressButton(`ar-${first.key}`);
      await settledTo(parts, new Set(), `button "${labelOf(first, true)}"`, null);
    }
    // its size on the wall, every part shut: the same box as the model's own, unscaled and untilted
    const sz = await js(`JSON.stringify((() => { const mv = document.querySelector('model-viewer'); const sym = (o, n) => { for (; o; o = Object.getPrototypeOf(o)) { const x = Object.getOwnPropertySymbols(o).find((y) => y.description === n); if (x) return x; } };
      const sc = mv[sym(mv, 'scene')]; sc.updateMatrixWorld(true); const b = new (sc.boundingBox.constructor)().setFromObject(sc.model), v = b.getSize(sc.pivot.position.clone()), d = mv.getDimensions();
      return { scale: sc.pivot.scale.x, world: [v.x, v.y, v.z], model: [d.x, d.y, d.z] }; })())`);
    check(sz.scale === 1 && sz.world.every((v, i) => Math.abs(v - sz.model[i]) < 0.003),
      `real size: scale ${sz.scale}, ${sz.world.map((v) => (v * 100).toFixed(1)).join(" x ")} cm on the wall, ${sz.model.map((v) => (v * 100).toFixed(1)).join(" x ")} cm in 3D`);
    await lookAt();
    lookCheck(await lookNow(), "on the wall");
    await partsInAR(product);
    s = await stand(300);
    check(Math.abs(s.scale - 1) < 1e-9 && dist(g.back, (await js(`JSON.stringify((() => { const mv = document.querySelector('model-viewer'); const sym = (o, n) => { for (; o; o = Object.getPrototypeOf(o)) { const x = Object.getOwnPropertySymbols(o).find((y) => y.description === n); if (x) return x; } };
      const sc = mv[sym(mv, 'scene')], bb = sc.boundingBox; sc.updateMatrixWorld(true); const back = bb.getCenter(sc.pivot.position.clone()); back.z = bb.min.z; const w = sc.target.localToWorld(back); return [w.x, w.y, w.z]; })())`))) < 0.0005,
      "after all the taps it is still on the same spot of the wall, at real size");
    await b.shot(`${out}/${id}-wall.png`);
    const left = await leaveAR();
    s = await stand(800);
    check(left && s.shown && !/aiming|placed/.test(s.ui), "leaving AR gives the 3D view back with the product showing");
    await b.evalJS("window.__phone.state.wall = null");
  } else {
    let s = await stand(800);
    check(/aiming/.test(s.ui) && !s.shown && s.place === "disabled" && /Point the dot/.test(s.status),
      `before the floor is found: only the dot, Place here greyed out ("${s.status.replace(/\n/g, " / ")}")`);

    await b.evalJS("window.__phone.state.floorFound = true");
    const A = await b.evalJS("window.__phone.centreHit()");
    const found = (s) => s.place === "enabled" && !s.shown && dist(s.goal, A) < 0.002 && /real size on the floor/.test(s.status);
    s = await standUntil(found);
    check(found(s),
      `the floor is found: its footprint goes where the dot points ${fmt(A)}, Place here lights up`);

    // walk a little and point somewhere else; the footprint follows the dot
    await aim([0.2, 0.05, 0.3], [-0.45, F, -1.9]);
    const B = await b.evalJS("window.__phone.centreHit()");
    s = await stand(1500);
    await b.shot(`${out}/${id}-aiming.png`);
    check(dist(s.goal, B) < 0.002 && dist(s.at, B) < 0.03, `pointing somewhere else moves the footprint there (${fmt(s.at)})`);

    await b.evalJS("document.getElementById('arPlace').click()");
    s = await stand(300);
    check(s.shown && dist(s.at, B) < 0.001, `Place here stands it on exactly that spot: ${fmt(s.at)} vs ${fmt(B)} (${(dist(s.at, B) * 1000).toFixed(1)} mm)`);
    check(facing(s) < 1, `its front faces the phone (${facing(s).toFixed(1)} degrees off)`);
    check(s.scale === 1, `real size: scale ${s.scale}, ${info.dims.map((v) => (v * 100).toFixed(1)).join(" x ")} cm`);
    check(/placed/.test(s.ui) && /stays on this spot/.test(s.status), `it says so ("${s.status.replace(/\n/g, " / ")}")`);
    await b.shot(`${out}/${id}-placed.png`);
    if (first) {
      check(await b.evalJS(`window.__demo.state['${first.key}'] === true`), `the ${first.label} opened in the 3D view is still open in AR`);
      await js("window.__t.snap(); window.__t.watch(); true");
      await settledTo(parts, new Set([first.key]), "as it was in the 3D view, all the way", null);
      await pressButton(`ar-${first.key}`);
      await settledTo(parts, new Set(), `button "${labelOf(first, true)}"`, null);
    }

    // the phone moves (customer walks around it) and a finger drags across it: it stays
    await aim([1.1, 0.1, -0.9], [-0.45, F + 0.5, -1.9]);
    const scr = JSON.parse(await b.evalJS(`JSON.stringify(window.__phone.project(${JSON.stringify(B)}))`));
    await b.evalJS(`window.__phone.touchStart(${scr[0]}, ${scr[1]})`);
    for (let i = 1; i <= 12; i++) { await b.evalJS(`window.__phone.touchMove(${scr[0] + i * 0.04}, ${scr[1] + i * 0.02})`); await sleep(40); }
    await b.evalJS("window.__phone.touchEnd()");
    for (let k = 0; k < 5; k++) { await b.evalJS(`window.__phone.touchStart(${scr[0]}, ${scr[1]})`); await sleep(60); await b.evalJS("window.__phone.touchEnd()"); await sleep(60); }
    s = await stand(1200);
    check(dist(s.at, B) < 0.0005, `walking round it and dragging a finger across it leaves it where it is (${(dist(s.at, B) * 1000).toFixed(2)} mm)`);
    // a swipe across the empty floor used to spin it
    const yaw0 = s.yaw;
    await b.evalJS("window.__phone.touchStart(-0.8, 0.85)");
    for (let i = 1; i <= 14; i++) { await b.evalJS(`window.__phone.touchMove(${-0.8 + i * 0.1}, 0.85)`); await sleep(40); }
    await b.evalJS("window.__phone.touchEnd()");
    s = await stand(1200);
    check(Math.abs(s.yaw - yaw0) < 1e-4 && dist(s.at, B) < 0.0005, `a one-finger swipe across the screen doesn't spin it (${((s.yaw - yaw0) * 180 / Math.PI).toFixed(2)} degrees)`);

    // Move to another spot, then a tap on the camera view places it
    await b.evalJS("document.getElementById('arMove').click()");
    s = await stand(300);
    check(/aiming/.test(s.ui) && !s.shown, "Move to another spot: back to the dot and the footprint");
    await aim([1.1, 0.1, -0.9], [1.4, F, -2.6]);
    const C = await b.evalJS("window.__phone.centreHit()");
    // a tap places it where the footprint is, so tap once the footprint has reached the new spot
    await standUntil((s) => s.place === "enabled" && dist(s.goal, C) < 0.002, 8000);
    await b.click(206, 430);
    const placedC = (s) => s.shown && dist(s.at, C) < 0.001 && facing(s) < 1;
    s = await standUntil(placedC);
    check(placedC(s), `a tap on the camera view places it on the new spot (${(dist(s.at, C) * 1000).toFixed(1)} mm off, facing the phone)`);

    // the look, then every part, from in front of it
    await lookAt();
    lookCheck(await lookNow(), "in the room");
    await b.shot(`${out}/${id}-front.png`);
    await partsInAR(product);
    s = await stand(300);
    check(dist(s.at, C) < 0.0005 && s.scale === 1, `after all the parts it is still on its spot, at real size (${(dist(s.at, C) * 1000).toFixed(2)} mm)`);

    const left = await leaveAR();
    s = await stand(800);
    check(left && s.shown && !/aiming|placed/.test(s.ui), "leaving AR gives the 3D view back with the product showing");

    // a second visit starts again from the dot; this time the phone faces back the way the first visit looked from
    // (the studio light must still light its front)
    await aim(eye, [0, F, 1.5]);
    await b.evalJS(`window.__phone.state.light = ${JSON.stringify(ROOM)}`);
    await enterAR();
    const D = await b.evalJS("window.__phone.centreHit()");
    s = await stand(1200);
    check(/aiming/.test(s.ui) && !s.shown && dist(s.goal, D) < 0.002, "opening AR again starts from the dot");
    await b.evalJS("document.getElementById('arPlace').click()");
    s = await stand(300);
    check(s.shown && dist(s.at, D) < 0.001 && facing(s) < 1, `and places on the spot again, facing the phone though it now looks the other way (${facing(s).toFixed(1)} degrees off)`);
    await lookAt();
    lookCheck(await lookNow(), "facing the other way");
    await b.shot(`${out}/${id}-other-way.png`);
    // the phone's estimate of the room's light comes, its reflections later: the studio light holds till both are here
    await b.evalJS("window.__phone.state.light.on = true");
    await sleep(1500);
    let l = await lookNow();
    check(!l.estimate && l.env === look3d.env, "the room's light without its reflections yet: the studio light holds");
    later.push({ l, where: "the room's light without its reflections yet", how: "as bright as the studio light makes it", band: [0.7, 1.4], slack: 0.03 });
    await b.evalJS("window.__phone.reflect()");
    await sleep(1500);
    l = await lookNow();
    // How bright the room makes it is the room's business (this test room is made up), and so is how black a black
    // finish looks in it: this plain grey room has no lamp or window in it to catch, so black glass and black steel,
    // which show only what they reflect, go near black here as they would in such a room (28 Nov; dropped from this
    // check, which asked for no more near-black than the 3D view's studio). What the page must do is use the room's
    // light, where the room is, burn nothing out, and let the room's reflections reach the product: a brighter room
    // makes it brighter.
    check(l.estimate && l.env !== look3d.env && Math.abs(l.envTurn) < 1e-6 && l.pixels > 500 && l.hot <= look3d.hot + 0.05,
      `with the room's reflections: the room's light, where the room is, nothing burnt out (brightness ${l.mean.toFixed(2)}, ${(l.dark * 100).toFixed(1)} % near black, ${(l.hot * 100).toFixed(1)} % white, in a plain grey test room)`);
    await b.evalJS("window.__phone.state.light.reflection = [235, 232, 228]; window.__phone.reflect()");
    await sleep(1500);
    const l2 = await lookNow();
    check(l2.estimate && l2.env === l.env && l2.pixels > 500 && l2.mean > l.mean + 0.005 && l2.hot <= look3d.hot + 0.05,
      `the room's reflections reach it: a brighter room makes it brighter (${l.mean.toFixed(3)} to ${l2.mean.toFixed(3)}), nothing burnt out (${(l2.hot * 100).toFixed(1)} % white)`);
    await b.evalJS("window.__phone.state.session.end()");
    await b.waitFor("document.querySelector('model-viewer').getAttribute('ar-status') === 'not-presenting'", 5000);
  }
  await judgeLater(info.wall);
  // nothing stuck once AR is over, and the 3D view's own buttons still work
  await sleep(500);
  const stuck = await js("JSON.stringify(window.__t.stuck())");
  check(!stuck.length, `nothing is left stuck after AR${stuck.length ? `: ${stuck.join(", ")}` : ""}`);
  if (parts.length) {
    const p = parts.find((x) => !x.needs);
    await b.evalJS(`document.getElementById('part-${p.key}').scrollIntoView({ block: 'center' })`);
    await sleep(300);
    await pressButton(`part-${p.key}`);
    await idle();
    check(await b.evalJS(`window.__demo.state['${p.key}'] === true`), `back in the 3D view its "${labelOf(p, false)}" button still works`);
  }
  let errors = b.logs.filter((l) => /EXC|error/i.test(l));
  check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);

  // ── every colour, opened straight from its own link, into AR; then another colour picked inside AR ──
  const fins = product.finishes || [];
  if (fins.length > 1) for (const [i, f] of fins.entries()) {
    const own = finishPath(product, i), path = own ? encodeURI(own) : `/p/${id}?finish=${finishSlug(f.name)}`;
    if (!(await load(path))) { check(false, `${f.name}: ${path} loads`); continue; }
    const want = f.variant || f.name;
    await b.evalJS("window.__phone.state.floorFound = false");
    await aim(eye, info.wall ? [0.15, 0.55, WALL] : [0.3, F, -1.6]);
    if (!check(await enterAR(), `${f.name}: ${path} straight into AR`)) continue;
    if (info.wall) await placeOnWall(); else await placeOnFloor([0.3, F, -1.6]);
    let c = await until(`(() => { const c = window.__t.colour(${JSON.stringify(want)}); return c.n && !c.bad && c.variant === ${JSON.stringify(want)} ? JSON.stringify(c) : null; })()`, 12000);
    if (!c || c.__error) c = await js(`JSON.stringify(window.__t.colour(${JSON.stringify(want)}))`); else c = JSON.parse(c);
    check(c.n > 0 && !c.bad && c.variant === want, `${f.name}: AR shows ${want}'s materials on all ${c.n} meshes${c.bad ? `; ${c.bad} wrong: ${c.first.join("; ")}` : ""}${c.variant !== want ? `; variant ${c.variant}` : ""}`);
    const ui = await js("JSON.stringify(window.__t.buttons())");
    check(!ui.bad.length, `${f.name}: every AR button, the ${fins.length} colours too, is on the screen and uncovered${ui.bad.length ? `: ${ui.bad.join(", ")}` : ""}`);
    // pick the next colour inside AR
    const j = (i + 1) % fins.length, next = fins[j].variant || fins[j].name;
    const [x, y] = await js(`JSON.stringify((() => { const r = document.querySelectorAll('#arFinishes button')[${j}].getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; })())`);
    await tap(x, y, false);
    c = await until(`(() => { const c = window.__t.colour(${JSON.stringify(next)}); return c.n && !c.bad && c.variant === ${JSON.stringify(next)} ? JSON.stringify(c) : null; })()`, 12000);
    if (!c || c.__error) c = await js(`JSON.stringify(window.__t.colour(${JSON.stringify(next)}))`); else c = JSON.parse(c);
    const where = finishPath(product, j);
    const addr = await b.evalJS("decodeURI(location.pathname)");
    check(c.n > 0 && !c.bad && c.variant === next && (!where || addr === where),
      `${f.name}: ${fins[j].name} picked inside AR shows its materials${c.bad ? ` (${c.bad} wrong: ${c.first.join("; ")})` : ""}, address ${addr}`);
    const inAR = await js("JSON.stringify(window.__t.materials())");
    await leaveAR();
    await sleep(600);
    const after = await js(`JSON.stringify({ c: window.__t.colour(${JSON.stringify(next)}), m: window.__t.materials(), pressed: [...document.querySelectorAll('#swatches .swatch')].findIndex((s) => s.getAttribute('aria-pressed') === 'true') })`);
    const same = Object.keys(inAR).every((k) => after.m[k] === inAR[k]);
    check(!after.c.bad && after.c.variant === next && after.pressed === j && same, `${f.name}: leaving AR keeps ${fins[j].name} (swatch ${after.pressed + 1} of ${fins.length}${same ? ", the same materials as in AR" : ", materials changed"})`);
    errors = b.logs.filter((l) => /EXC|error/i.test(l));
    check(errors.length === 0, `${f.name}: no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
  }
}
console.log(`\n${failed} failed`);
b.close();
process.exit(failed ? 1 : 0);
