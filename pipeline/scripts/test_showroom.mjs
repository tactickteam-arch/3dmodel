// Checks the 3D showroom (/showroom) on a laptop and a phone, then in Meta's WebXR emulator (IWER, a Quest 3) in
// VR and in passthrough:
// - the hall is laid out from products.json: an aisle per category, every product on show once, none overlapping,
//   each facing its walkway, a chip for each and a count per category;
// - the loader: never more than its cap loaded or loading at once, over a flight past every product and with
//   ?cap=4; models left behind are unloaded; none fail;
// - a chip flies to its product and opens its card (with its /p/ link); a tap on a door opens it (with a mouse,
//   and a finger on the phone); a tap on a product further off flies to it; the card's buttons open and close a
//   part; a category filters the chips and flies to its aisle;
// - ?focus=<id> and /showroom/<id> open in front of that product; an unknown id says so;
// - a product not loaded stands as a box of its size in its first colour, its photo on the front; name tags never
//   sit under the page's buttons, card or dock;
// - a phone (390x844): nothing wider than the screen; the product, its card and the dock all in view;
// - VR: it starts in front of ?focus; the trigger opens a door; pointing at the floor teleports; the panel's aisle
//   buttons teleport there; the thumbstick turns 30 degrees; a pinch (Vision Pro's transient-pointer, which IWER
//   doesn't emulate: forced here by selecting from the pose at the moment of the press) opens a door; the loader
//   keeps to the headset's cap; Exit puts the page back;
// - passthrough: the hall is hidden; one category stands in a ring about 2.4 m round you, facing you; a door opens;
//   the panel switches category, and between them they show every product; air conditioners hang at 2.05 m;
// - no console errors.
// Emulation only: headless Chrome (SwiftShader) and IWER, not a real phone, Quest or Vision Pro.
// usage: node test_showroom.mjs <base url> <out dir> <iwer.min.js>   (PORT and PORT+1: the two browsers' debugging ports)
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out, iwerPath = "tools/iwer.min.js"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let failed = 0, passed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const QUEST_UA = "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.2.0.4.53 SamsungBrowser/4.0 Chrome/128.0.6613.137 VR Safari/537.36";
const PORT = +(process.env.PORT || 9471);
// read again before the headset part: products may be added while this runs
let products, byId;
const refresh = async () => {
  products = (await (await fetch(`${base}/products.json`)).json()).products.filter((p) => !p.hidden);
  byId = new Map(products.map((p) => [p.id, p]));
};
await refresh();
const sz = (p) => ({ w: parseFloat(p.size.w) / 100, h: parseFloat(p.size.h) / 100, d: parseFloat(p.size.d) / 100 });
const doorOf = (p) => (p.parts || []).find((x) => x.zone && !x.needs);
// a part's tap point in its model: the middle of its front face, or of its top for a flat lid (as test_features.mjs)
const frontOf = (part, inset = 0) => {
  const [a, z] = part.zone.closed;
  const flat = z[1] - a[1] < 0.12 && z[2] - a[2] > 0.2;
  return flat ? [(a[0] + z[0]) / 2, z[1] - inset, (a[2] + z[2]) / 2] : [(a[0] + z[0]) / 2, (a[1] + z[1]) / 2, z[2] - inset];
};
const X = products.find((p) => p.category === "Refrigerator" && doorOf(p)) || products.find(doorOf);       // the product most checks use
const W = products.find((p) => p.category === "Washing machine" && doorOf(p) && p.id !== X.id) || products.find((p) => p.id !== X.id);
const hyp = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

let b;
const sr = (expr) => b.evalJS(`window.__showroom.${expr}`);
const slotOf = async (id) => (await sr("slots()")).find((s) => s.id === id);
const ready = () => b.waitFor("!!window.__showroom && !document.getElementById('loading')", 60000);
const settle = async () => { await sleep(150); await b.waitFor("!window.__showroom.camera().flying", 8000); await sleep(250); };
const loadedSoon = (id, ms = 120000) => b.waitFor(`window.__showroom.slots().find((s) => s.id === "${id}").loaded`, ms);
const mouse = async (x, y) => { for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); };
const finger = async (x, y) => { await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await sleep(60); await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
const canvasAt = (pt) => b.evalJS(`document.elementFromPoint(${pt[0]}, ${pt[1]})?.tagName === "CANVAS"`);
// the middle of an element, once it is scrolled into view (the chips scroll smoothly)
const center = async (sel) => {
  await b.evalJS(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "nearest", inline: "center" })`);
  await sleep(800);
  return b.evalJS(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
};
const errorsIn = (logs) => logs.filter((l) => /EXCEPTION|\[error\]|Uncaught/.test(l));
// name tags shown over the page's own buttons, card or dock (there should be none)
const tagsUnderUI = () => b.evalJS(`(() => {
  const ui = ["hint", "btnOverview", "btnVR", "btnAR", "pcard", "dock"].map((id) => document.getElementById(id))
    .filter((e) => e && e.offsetParent && !e.classList.contains("gone") && getComputedStyle(e).opacity !== "0").map((e) => [e.id, e.getBoundingClientRect()]);
  return [...document.querySelectorAll("#labels .tag")].filter((t) => t.style.display !== "none").flatMap((t) => { const r = t.getBoundingClientRect();
    return ui.filter(([, u]) => r.left < u.right && u.left < r.right && r.top < u.bottom && u.top < r.bottom).map(([id]) => t.textContent.trim().slice(0, 24) + " / " + id); });
})()`);
// every product not loaded stands as a box in its first colour with its photo on the front; a loaded one doesn't
const standIns = async () => {
  const all = await sr("slots()");
  const want = (id) => (byId.get(id).finishes[0].swatchColor || "#d9d9dc").toLowerCase();
  const bad = all.filter((x) => (x.loaded ? x.stand.shown : !x.stand.shown || x.stand.tint !== want(x.id) || !x.stand.photo));
  return { n: all.filter((x) => !x.loaded).length, bad: bad.map((x) => `${x.id} ${JSON.stringify(x.stand)}`) };
};

// ───────────── laptop ─────────────
b = await launch({ profile: `${out}/prof`, port: PORT });
await b.viewport(1440, 900, false, MAC);
console.log("\n[laptop 1440x900: the hall]");
await b.go(`${base}/showroom`);
check(await ready(), "the showroom opens");
let lay = await sr("layout()");
let slots = await sr("slots()");
const cats = [...new Set(products.map((p) => p.category))];
check(slots.length === products.length && new Set(slots.map((s) => s.id)).size === products.length, `every product on show stands in the hall once (${slots.length})`);
check(cats.every((c) => lay.aisles.some((a) => a.cat === c)) && cats.every((c) => lay.aisles.filter((a) => a.cat === c).reduce((n, a) => n + a.n, 0) === products.filter((p) => p.category === c).length),
  `an aisle per category: ${lay.aisles.map((a) => `${a.cat}${a.of > 1 ? ` ${a.part}/${a.of}` : ""} (${a.n})`).join(", ")}; hall ${lay.W} x ${lay.D} m`);
// floor units' footprints don't overlap; every product faces the middle of its aisle and stands inside the hall
const foot = slots.filter((s) => byId.get(s.id).placement !== "wall").map((s) => {
  const d = sz(byId.get(s.id)), along = Math.abs(s.front[0]) > 0.5; // turned to face ±x: width runs along z
  const hx = (along ? d.d : d.w) / 2, hz = (along ? d.w : d.d) / 2;
  return { id: s.id, x: [s.center[0] - hx, s.center[0] + hx], z: [s.center[2] - hz, s.center[2] + hz] };
});
const clash = foot.flatMap((a, i) => foot.slice(i + 1).filter((c) => a.x[0] < c.x[1] - 0.001 && c.x[0] < a.x[1] - 0.001 && a.z[0] < c.z[1] - 0.001 && c.z[0] < a.z[1] - 0.001).map((c) => `${a.id}/${c.id}`));
check(!clash.length, `no two products overlap${clash.length ? `: ${clash.slice(0, 3).join(", ")}` : ""}`);
const facing = slots.filter((s) => { const a = lay.aisles.find((x) => s.center[0] >= x.x[0] && s.center[0] <= x.x[1]); return a && s.front[0] * (a.mid - s.center[0]) > 0; });
check(facing.length === slots.length, `each faces its aisle's walkway (${facing.length} of ${slots.length})`);
check(slots.every((s) => Math.abs(s.center[0]) < lay.W / 2 && s.center[2] < 0 && s.center[2] > -lay.D), "all inside the hall");
const dock = await b.evalJS(`({ chips: [...document.querySelectorAll("#chips .chip")].map((c) => c.dataset.id), cats: [...document.querySelectorAll("#cats .cat")].map((c) => [c.dataset.cat, +c.querySelector(".n").textContent]) })`);
check(dock.chips.length === products.length && dock.cats[0][1] === products.length && dock.cats.slice(1).every(([c, n]) => n === products.filter((p) => p.category === c).length),
  `a chip for each product, and counts ${dock.cats.map(([c, n]) => `${c || "All"} ${n}`).join(", ")}`);

console.log("\n[the loader]");
await b.waitFor("window.__showroom.loader().loading === 0 && window.__showroom.loader().loaded > 0", 180000);
let ld = await sr("loader()");
const caps = await sr("caps");
check(caps.CAP === 10 && ld.cap === 10 && caps.TEX_MAX === 4096, `a laptop loads up to ${caps.CAP} at once, textures up to ${caps.TEX_MAX} px`);
await b.waitFor("window.__showroom.slots().every((s) => s.loaded || s.stand.photo)", 30000);
let si = await standIns();
check(si.n > 0 && !si.bad.length, `the ${si.n} not loaded stand as a box in their colour with their photo on the front; the loaded ones don't${si.bad.length ? `: ${si.bad.slice(0, 2).join(", ")}` : ""}`);
check(ld.loaded <= ld.cap && ld.maxSeen <= ld.cap && !ld.failed.length, `from the entrance: ${ld.loaded} loaded (most at once ${ld.maxSeen}), none failed`);
check((await sr("labels()")).length === 0, "from the entrance the aisle signs name things, not a tag on every product");
await b.shot(`${out}/showroom-overview.png`);

console.log("\n[a chip, a door, the card]");
const chipPt = await center(`.chip[data-id="${X.id}"]`);
await mouse(chipPt[0], chipPt[1]);
await settle();
let card = await sr("card()");
let cam = await sr("camera()");
let sx = await slotOf(X.id);
const camDist = Math.hypot(...cam.pos.map((v, i) => v - sx.center[i]));
check(await sr("selected()") === X.id && card.shown && card.name === X.shortName && card.link === `/p/${X.id}`, `the ${X.id} chip opens its card (${card.name}, ${card.link})`);
check(camDist > 1.2 && camDist < 3 && hyp(cam.target, sx.center) < 0.05, `and flies to it: ${camDist.toFixed(2)} m from it, looking at it`);
const labels = await sr("labels()");
const cut = await b.evalJS(`(() => { const st = document.getElementById("stage").getBoundingClientRect();
  return [...document.querySelectorAll("#labels .tag")].filter((t) => t.style.display !== "none").filter((t) => { const r = t.getBoundingClientRect(); return r.top < st.top || r.left < st.left || r.right > st.right; }).length; })()`);
check(labels.length > 0 && labels.length <= 14 && !cut, `up close, whole name tags on ${labels.length} products near it (${cut} cut off)`);
let under = await tagsUnderUI();
check(!under.length, `no name tag under the buttons, card or dock${under.length ? `: ${under.join(", ")}` : ""}`);
check(await loadedSoon(X.id), "its 3D model loads");
await sleep(600);
check(await b.evalJS(`[...document.querySelectorAll("#pcParts button")].length === ${X.parts.length} && [...document.querySelectorAll("#pcParts button")].every((x) => !x.disabled)`), `the card has its ${X.parts.length} part buttons, enabled once loaded`);
sx = await slotOf(X.id);
check(sx.meshes > 0 && sx.meshes < 160, `its model is drawn with ${sx.meshes} meshes (fixed parts merged, food left out)`);
await b.shot(`${out}/showroom-product.png`);
const door = doorOf(X);
let pt = await sr(`screenOf("${X.id}", ${JSON.stringify(frontOf(door))})`);
if (pt && await canvasAt(pt)) {
  await mouse(pt[0], pt[1]);
  await sleep(1600);
  sx = await slotOf(X.id);
  check(sx.state[door.key] && Object.values(sx.state).filter(Boolean).length === 1, `a click on its ${door.key} opens it (${JSON.stringify(sx.state)})`);
  check(await b.evalJS(`document.querySelector('#pcParts button[data-key="${door.key}"]').getAttribute("aria-pressed") === "true"`), "and the card's button says so");
} else check(false, `the ${door.key} is on screen and not under anything: ${pt} ${pt && await b.evalJS(`document.elementFromPoint(${pt[0]}, ${pt[1]})?.className`)}`);
await b.shot(`${out}/showroom-door-open.png`);
await b.evalJS(`document.querySelector('#pcParts button[data-key="${door.key}"]').click()`);
await sleep(1600);
sx = await slotOf(X.id);
check(!sx.state[door.key], `the card's button shuts the ${door.key} again`);

console.log("\n[categories, a tap from afar]");
const wCat = W.category, wAisle = lay.aisles.find((a) => a.cat === wCat);
await b.evalJS(`document.querySelector('.cat[data-cat="${wCat}"]').click()`);
await settle();
const vis = await b.evalJS(`[...document.querySelectorAll("#chips .chip")].filter((c) => !c.classList.contains("hide")).map((c) => c.dataset.id)`);
cam = await sr("camera()");
check(vis.length === products.filter((p) => p.category === wCat).length && vis.every((id) => byId.get(id).category === wCat), `"${wCat}" shows only its ${vis.length} chips`);
check(Math.abs(cam.pos[0] - wAisle.mid) < 0.3 && Math.abs(cam.target[0] - wAisle.mid) < 0.3, `and flies to its aisle (camera x ${cam.pos[0]}, aisle ${wAisle.mid})`);
await b.evalJS(`document.querySelector('.cat[data-cat=""]').click()`);
await settle();
check(await b.evalJS(`![...document.querySelectorAll("#chips .chip")].some((c) => c.classList.contains("hide"))`), "All shows every chip again");
await b.evalJS("document.getElementById('btnOverview').click()");
await settle();
check(await sr("selected()") === null && !(await sr("card()")).shown, "Whole showroom closes the card");
// the product nearest the entrance, tapped on its top from the overview
const near = slots.filter((s) => s.id !== X.id && byId.get(s.id).placement !== "wall").sort((a, c) => c.center[2] - a.center[2])[0];
pt = await sr(`screenOf("${near.id}", [0, ${sz(byId.get(near.id)).h - 0.01}, 0])`);
if (pt && await canvasAt(pt)) {
  await mouse(pt[0], pt[1]);
  await settle();
  cam = await sr("camera()");
  check(await sr("selected()") === near.id && Math.hypot(...cam.pos.map((v, i) => v - near.center[i])) < 3, `a click on ${near.id} from the overview flies to it`);
} else check(false, `${near.id} can be clicked from the overview (${pt})`);

console.log("\n[a flight past every product]");
await b.evalJS("window.__showroom.resetMax()");
const before = await sr("loader()");
let worst = 0;
const worstUnder = [];
for (const id of dock.chips) {
  await b.evalJS(`document.querySelector('.chip[data-id="${id}"]').click()`);
  await settle();
  await sleep(500);
  ld = await sr("loader()");
  worst = Math.max(worst, ld.loaded + ld.loading);
  worstUnder.push(...(await tagsUnderUI()).map((u) => `${id}: ${u}`));
}
check(await loadedSoon(dock.chips.at(-1)), `the last one (${dock.chips.at(-1)}) loads when you reach it`);
ld = await sr("loader()");
const mem = await sr("memory()");
check(ld.maxSeen <= ld.cap && worst <= ld.cap, `never more than ${ld.cap} loaded or loading (most seen ${ld.maxSeen})`);
check(worstUnder.length === 0, `at every stop, no name tag under the buttons, card or dock${worstUnder.length ? `: ${worstUnder.slice(0, 3).join(", ")}` : ""}`);
si = await standIns();
check(!si.bad.length, `after it, every product is either its model or its coloured stand-in${si.bad.length ? `: ${si.bad.slice(0, 2).join(", ")}` : ""}`);
check(ld.unloads > before.unloads && ld.loads > before.loads && !ld.failed.length, `${ld.loads - before.loads} loads and ${ld.unloads - before.unloads} unloads on the way, none failed`);
console.log(`       now ${ld.loaded} loaded, ${mem.geometries} geometries, ${mem.textures} textures, ${await sr("draws()")} draw calls`);
await b.go(`${base}/showroom?cap=4`);
await ready();
await b.evalJS("window.__showroom.resetMax()");
for (const id of dock.chips.slice(0, 10)) { await b.evalJS(`document.querySelector('.chip[data-id="${id}"]').click()`); await settle(); }
await sleep(1500);
ld = await sr("loader()");
check(ld.cap === 4 && ld.maxSeen <= 4 && ld.loaded <= 4, `?cap=4: most at once ${ld.maxSeen}, now ${ld.loaded}`);

console.log("\n[?focus and /showroom/<id>]");
for (const url of [`/showroom?focus=${W.id}`, `/showroom/${W.id}`]) {
  await b.go(`${base}${url}`);
  await ready();
  await sleep(300);
  cam = await sr("camera()");
  const sw = await slotOf(W.id);
  const d = Math.hypot(...cam.pos.map((v, i) => v - sw.center[i]));
  const at = await sr(`screenOf("${W.id}", [0, ${sz(W).h / 2}, ${sz(W).d / 2}])`);
  const inView = at && await b.evalJS(`${at[1]} > 64 && ${at[1]} < document.getElementById("dock").getBoundingClientRect().top && ${at[0]} > 0 && ${at[0]} < innerWidth`);
  check(await sr("selected()") === W.id && (await sr("card()")).shown && d < 3 && inView, `${url} opens in front of it (${d.toFixed(2)} m away, its middle at ${at?.map(Math.round)})`);
}
await b.go(`${base}/showroom?focus=no-such-thing`);
await ready();
await sleep(300);
await b.waitFor(`document.getElementById("toast").textContent.includes("isn’t in the showroom")`, 5000);
check(await sr("selected()") === null && await b.evalJS(`document.getElementById("toast").textContent.includes("isn’t in the showroom")`), "an unknown id shows the whole hall, with a note");

console.log("\n[phone 390x844]");
await b.viewport(390, 844, true, IPHONE);
await b.go(`${base}/showroom?focus=${X.id}`);
await ready();
await sleep(800);
const pc = await sr("caps");
check(pc.CAP === 6 && pc.TEX_MAX === 1024, `a phone loads up to ${pc.CAP} at once, textures up to ${pc.TEX_MAX} px`);
const ph = await b.evalJS(`(() => { const r = (id) => document.getElementById(id).getBoundingClientRect();
  const wide = [...document.querySelectorAll("body *")].filter((e) => !e.closest("#chips, #cats, #labels") && e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.id || e.className).slice(0, 3);
  return { scroll: document.documentElement.scrollWidth, inner: innerWidth, h: innerHeight, wide, card: [r("pcard").top, r("pcard").bottom], dock: [r("dock").top, r("dock").bottom] }; })()`);
check(ph.scroll <= ph.inner && !ph.wide.length, `nothing wider than the screen (page ${ph.scroll} px of ${ph.inner}${ph.wide.length ? `; too wide: ${ph.wide.join(", ")}` : ""})`);
check(ph.dock[1] <= ph.h + 1 && ph.card[1] <= ph.dock[0] + 1 && ph.card[0] > 64, `card (${ph.card.map(Math.round)}) above the dock (${ph.dock.map(Math.round)}), both on screen`);
const top = await sr(`screenOf("${X.id}", [0, ${sz(X).h}, 0])`);
check(top && top[1] > 56 && top[1] < ph.card[0], `the product stands above its card (its top at ${top?.map(Math.round)})`);
await b.shot(`${out}/showroom-phone-focus.png`);
under = await tagsUnderUI();
check(!under.length, `no name tag under the card or dock on the phone${under.length ? `: ${under.join(", ")}` : ""}`);
check(await loadedSoon(X.id), "its model loads on the phone");
await sleep(800);
pt = await sr(`screenOf("${X.id}", ${JSON.stringify(frontOf(door))})`);
if (pt && await canvasAt(pt)) {
  await finger(pt[0], pt[1]);
  await sleep(1600);
  check((await slotOf(X.id)).state[door.key], `a finger tap on its ${door.key} opens it`);
} else check(false, `the ${door.key} can be tapped on the phone (${pt})`);
await b.shot(`${out}/showroom-phone-door.png`);
await b.evalJS("document.getElementById('btnOverview').click()");
await settle();
await b.shot(`${out}/showroom-phone-overview.png`);
check(!(await b.evalJS("!document.getElementById('btnVR').classList.contains('hide') || !document.getElementById('btnAR').classList.contains('hide')")), "no headset buttons on a phone");
const deskErrs = errorsIn(b.logs);
check(!deskErrs.length, deskErrs.length ? `console errors: ${deskErrs.slice(0, 3).join(" | ")}` : "no console errors on the laptop and phone");
b.close();

// ───────────── Quest 3 in IWER ─────────────
b = await launch({ profile: `${out}/prof-xr`, port: PORT + 1 });
await b.viewport(1280, 800, false, QUEST_UA);
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: fs.readFileSync(iwerPath, "utf8") + `
;window.__dev = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: false });
window.__dev.installRuntime({ forceInstall: true });
// this IWER build reads the XRRigidTransform given to getOffsetReferenceSpace as if it were a matrix, so every offset
// space came out the same as its parent and a teleport never moved you; browsers apply it as the WebXR spec says,
// as this does by handing IWER the transform's matrix
const offset = XRReferenceSpace.prototype.getOffsetReferenceSpace;
XRReferenceSpace.prototype.getOffsetReferenceSpace = function (t) { return offset.call(this, t && t.matrix ? t.matrix : t); };` });
const xi = () => b.evalJS("window.__showroomXR.info()");
const xs = (expr) => b.evalJS(`window.__showroomXR.${expr}`);
// aim a controller from a point in the headset's own space at a world point; the ray points down -Z (as test_xr.mjs)
const aimDev = (who, from, to) => b.evalJS(`(() => {
  const c = window.__dev.controllers.${who}, f = ${JSON.stringify(from)}, t = ${JSON.stringify(to)};
  let x = t[0]-f[0], y = t[1]-f[1], z = t[2]-f[2]; const l = Math.hypot(x,y,z); x/=l; y/=l; z/=l;
  const ax = y, ay = -x, az = 0, w = 1 - z; const n = Math.hypot(ax, ay, az, w);
  c.position.set(f[0], f[1], f[2]);
  if (n < 1e-6) c.quaternion.set(0, 1, 0, 0); else c.quaternion.set(ax/n, ay/n, az/n, w/n);
  return true; })()`);
const HAND = [0.18, 1.25, -0.25];
const aim = async (world) => { await aimDev("right", HAND, await xs(`toDevice(${JSON.stringify(world)})`)); await sleep(450); };
const trigger = async () => {
  await b.evalJS("window.__dev.controllers.right.updateButtonValue('trigger', 1)"); await sleep(250);
  await b.evalJS("window.__dev.controllers.right.updateButtonValue('trigger', 0)"); await sleep(350);
};
const hover = async () => (await xi()).hovers.filter(Boolean);
const showView = () => b.evalJS(`(() => { const box = document.querySelector('[data-webxr_runtime]'); if (box) box.style.background = 'linear-gradient(#9aa0a6, #6f6a63)'; return true; })()`);
async function enter(button, mode) {
  const p = await center(`#${button}`);
  await b.click(p[0], p[1]);
  const ok = await b.waitFor("!!(window.__showroomXR.info() && window.__showroomXR.info().started)", 30000);
  await b.evalJS("window.__dev.position.set(0, 1.6, 0); window.__dev.quaternion.set(0, 0, 0, 1)");
  await aimDev("left", [-0.2, 1.2, -0.2], [-0.4, 3, -0.6]); // the left hand points up, at nothing
  await sleep(800);
  await showView();
  check(ok && (await xi()).mode === mode, `${button} starts ${mode === "vr" ? "VR" : "passthrough"}`);
  return ok;
}

console.log("\n[Quest 3 (IWER): VR]");
await refresh();
await b.go(`${base}/showroom?focus=${X.id}`);
await ready();
lay = await sr("layout()");
const qc = await sr("caps");
check(qc.canVR && qc.canAR && qc.CAP === 6 && qc.CAP_XR === 6 && qc.TEX_MAX === 1024, `Quest: VR and passthrough offered, ${qc.CAP} models at once, textures up to ${qc.TEX_MAX} px`);
if (await enter("btnVR", "vr")) {
  check(await b.evalJS(`document.body.classList.contains("in-xr") && getComputedStyle(document.getElementById("dock")).display === "none"`), "the page's buttons step aside");
  let info = await xi();
  sx = await slotOf(X.id);
  const stand = sx.center.map((v, i) => v + sx.front[i] * (sz(X).d / 2 + 1.25));
  check(hyp(info.head, stand) < 0.15, `it starts in front of ${X.id} (${hyp(info.head, stand).toFixed(2)} m from the spot)`);
  check(await loadedSoon(X.id, 120000), "its model loads");
  await sleep(800);
  const tgt = await xs(`worldOf("${X.id}", ${JSON.stringify(frontOf(door, 0.02))})`);
  await aim(tgt);
  const hv = await hover();
  check(hv.some((h) => h.type === "part" && h.id === X.id && h.key === door.key), `pointing at its ${door.key}: ${JSON.stringify(hv)}`);
  await trigger();
  await sleep(1400);
  check((await slotOf(X.id)).state[door.key], `the trigger opens its ${door.key}`);
  await b.shot(`${out}/showroom-vr-door.png`);
  // Vision Pro's gaze and pinch: the part comes from the pose at the moment of the pinch, not from the last hover
  await b.evalJS("window.__showroomXR.poseOnly(true)");
  await aim(await xs(`partWorld("${X.id}", "${door.key}")`));
  await trigger();
  await sleep(1400);
  check(!(await slotOf(X.id)).state[door.key], `a pinch (selected from its pose) shuts the ${door.key}`);
  await b.evalJS("window.__showroomXR.poseOnly(false)");

  // the thumbstick turns you where you stand
  info = await xi();
  await b.evalJS("window.__dev.controllers.right.updateAxes('thumbstick', 1, 0)"); await sleep(300);
  await b.evalJS("window.__dev.controllers.right.updateAxes('thumbstick', 0, 0)"); await sleep(300);
  let info2 = await xi();
  check(Math.abs(info2.yaw - (info.yaw - Math.PI / 6)) < 0.01 && hyp(info.head, info2.head) < 0.05, `the thumbstick turns you 30 degrees where you stand (yaw ${info.yaw} -> ${info2.yaw})`);
  await b.evalJS("window.__dev.controllers.right.updateAxes('thumbstick', -1, 0)"); await sleep(300);
  await b.evalJS("window.__dev.controllers.right.updateAxes('thumbstick', 0, 0)"); await sleep(300);

  // point at the floor along the aisle and pull the trigger: you're there
  info = await xi();
  const f = [sx.center[0] - info.head[0], sx.center[2] - info.head[2]], fl = Math.hypot(...f);
  const right = [-f[1] / fl, f[0] / fl];
  const spot = [info.head[0] + right[0] * 1.6, 0, info.head[2] + right[1] * 1.6];
  await aim(spot);
  check((await hover()).some((h) => h.type === "floor"), "pointing at the floor shows where you'd stand");
  await trigger();
  await sleep(400);
  info2 = await xi();
  check(hyp(info2.head, spot) < 0.1, `the trigger takes you there (${hyp(info2.head, spot).toFixed(2)} m off)`);

  // the panel: each aisle, then the entrance; the loader keeps to the headset's cap all the way
  await b.evalJS("window.__showroom.resetMax()");
  for (let i = 0; i < lay.aisles.length; i++) {
    await sleep(300); // the panel follows you after a teleport
    const btn = await xs(`menuButton("aisle:${i}")`);
    await aim(btn);
    const on = (await hover()).find((h) => h.type === "ui");
    await trigger();
    await sleep(1500);
    info = await xi();
    check(on?.button === `aisle:${i}` && Math.abs(info.head[0] - lay.aisles[i].mid) < 0.1 && Math.abs(info.head[2] - 0.6) < 0.1 && Math.abs(info.yaw) < 0.01,
      `the panel's "${lay.aisles[i].cat}${lay.aisles[i].of > 1 ? ` ${lay.aisles[i].part}` : ""}" takes you to that aisle (${info.head})`);
    if (i === 0) { await sleep(2500); await b.shot(`${out}/showroom-vr-aisle.png`); }
  }
  await sleep(300);
  await aim(await xs(`menuButton("home")`));
  await trigger();
  await sleep(1500);
  info = await xi();
  check(Math.abs(info.head[0]) < 0.1 && Math.abs(info.head[2] - 1.4) < 0.1, `"Entrance" takes you back (${info.head})`);
  await b.waitFor("window.__showroom.loader().loading === 0", 60000);
  ld = await sr("loader()");
  check(ld.cap === 6 && ld.near === 8 && ld.maxSeen <= 6 && ld.loaded <= 6 && !ld.failed.length, `in the headset never more than ${ld.cap} at once (most seen ${ld.maxSeen}; ${ld.loads} loads, ${ld.unloads} unloads)`);
  await b.shot(`${out}/showroom-vr-entrance.png`);
  await sleep(300);
  await aim(await xs(`menuButton("exit")`));
  await trigger();
  await sleep(1500);
  ld = await sr("loader()");
  check(!(await xi()) && !(await b.evalJS(`document.body.classList.contains("in-xr")`)) && ld.near === 10 && (await sr("slots()")).every((s) => s.visible), "Exit puts the page back");
}

console.log("\n[Quest 3 (IWER): passthrough]");
if (await enter("btnAR", "ar")) {
  let info = await xi();
  check(!info.hallVisible, "the hall is hidden: the room shows through");
  const seen = new Set();
  for (let k = 0; k < info.sets.length; k++) {
    if (k > 0) {
      await aim(await xs(`menuButton("set:${k}")`));
      await trigger();
      await sleep(600);
    }
    info = await xi();
    const vis = (await sr("slots()")).filter((s) => s.visible);
    vis.forEach((s) => seen.add(s.id));
    const cat = byId.get(vis[0].id).category;
    const O = info.ring, ring = vis.map((s) => hyp(s.center, O));
    const facingYou = vis.every((s) => { const dx = s.center[0] - O[0], dz = s.center[2] - O[2]; return -(s.front[0] * dx + s.front[2] * dz) / Math.hypot(dx, dz) > 0.97; });
    const walls = vis.filter((s) => byId.get(s.id).placement === "wall");
    const arc = vis.reduce((t, s) => t + sz(byId.get(s.id)).w + 0.45, 0);
    check(info.set === k && vis.every((s) => byId.get(s.id).category === cat) && ring.every((r, i) => (walls.some((w) => w.id === vis[i].id) ? r > 2 && r < 2.7 : Math.abs(r - 2.4) < 0.05)) && facingYou && arc <= 2 * Math.PI * 2.4 * 0.9 + 0.01,
      `"${info.sets[k]}": ${vis.length} ${cat} in a ring ${Math.min(...ring).toFixed(2)}-${Math.max(...ring).toFixed(2)} m round you, all facing you`);
    if (walls.length) check(walls.every((s) => Math.abs(s.center[1] - 2.05) < 0.02), `its air conditioners hang at 2.05 m (${walls.map((s) => s.center[1]).join(", ")})`);
    if (k === 0) {
      // a door on the one most in front of you
      const ahead = vis.filter((s) => doorOf(byId.get(s.id))).sort((a, c) => (a.center[2] - O[2]) / hyp(a.center, O) - (c.center[2] - O[2]) / hyp(c.center, O))[0];
      const pa = byId.get(ahead.id), dk = doorOf(pa);
      check(await loadedSoon(ahead.id, 120000), `${ahead.id}, straight ahead, loads`);
      await sleep(800);
      await aim(await xs(`worldOf("${ahead.id}", ${JSON.stringify(frontOf(dk, 0.02))})`));
      await trigger();
      await sleep(1400);
      check((await slotOf(ahead.id)).state[dk.key], `the trigger opens its ${dk.key}`);
      await b.shot(`${out}/showroom-ar-ring.png`);
    }
    if (walls.length) { await sleep(1500); await b.shot(`${out}/showroom-ar-walls.png`); }
  }
  check(seen.size === products.length, `between them the ${info.sets.length} sets show all ${products.length} products (${seen.size})`);
  ld = await sr("loader()");
  check(ld.maxSeen <= 6 && !ld.failed.length, `never more than 6 at once (most seen ${ld.maxSeen})`);
  await aim(await xs(`menuButton("exit")`));
  await trigger();
  await sleep(1500);
  check(!(await xi()) && (await sr("slots()")).every((s) => s.visible), "Exit puts the hall back");
}
const xrErrs = errorsIn(b.logs);
check(!xrErrs.length, xrErrs.length ? `console errors: ${xrErrs.slice(0, 3).join(" | ")}` : "no console errors in the headset");
b.close();
console.log(`\n${passed} passed, ${failed} failed checks`);
process.exit(failed ? 1 : 0);
