// Checks the 3D showroom (/showroom) on a laptop and a phone, then in Meta's WebXR emulator (IWER, a Quest 3) in
// VR and in passthrough:
// - the hall is laid out from products.json: an aisle per category, every product on show once, none overlapping,
//   each facing its walkway, a chip for each and a count per category;
// - it opens at eye height inside the entrance; a frame there is timed; the up arrow walks, the left arrow turns, and
//   with the search box focused (by "/") they don't; a model code typed in and Enter walks you to that product; its
//   card and chip show the MOP placeholder;
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
// - nothing leaks: every model, shut and with each part open, stays inside its aisle (off the partitions and walls,
//   on or over the floor, under the partition tops) and clear of every other model and its open parts; the hall's
//   faces never fight for the same depth (z-fighting), from the entrance, down an aisle, at the far end, close to a
//   partition and from far out;
// - round 4: filters (brand, 3 stars and up, Clear) dim the rest under veils; a tap on the floor plan walks there;
//   the guided tour starts, steps to the next category and stops; on the card a swatch reloads the model in that
//   colour, "View in your room" links that colour's product page, Fill the fridge fills it, Share copies the
//   ?focus link and Compare opens /compare with both; ?aisle= and ?q= links; Tab reaches every control in page
//   order; reduced motion moves at once; ?kiosk starts the tour when left alone and a touch stops it; a model
//   that fails keeps its stand-in and loads on Try again; without WebGL a message links the catalogue; on a phone
//   the floor plan starts folded; the hint, floor plan, buttons, loading bar and card never overlap (phone, and a
//   1366x768 laptop with the card open); in a headset the floor plan, tour bar, filters and search list step aside;
// - growth: served ~130 products in place of products.json (40 clones, a new category, a hidden one), every
//   product stands once, the new category gets an aisle, no product or open door reaches another, each stays in
//   its aisle, signs, panels, talkers, room sets, plants and the shop front clear every product and each other,
//   the hall is built to its new size, search finds a clone, the overview still fits (laptop and phone), draw
//   calls stay under 1000, the hidden one is absent;
// - no console errors.
// Emulation only: headless Chrome (SwiftShader) and IWER, not a real phone, Quest or Vision Pro.
// usage: node test_showroom.mjs <base url> <out dir> <iwer.min.js>   (PORT and PORT+1: the two browsers' debugging ports)
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";
import { finishPath } from "../../site.js"; // the card links each colour's product page, as the catalogue does

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
// a product's boxes (from __showroom.boxes, in its own frame) as footprints in the room (4 corners in x, z), a height
// range and a world box round them
const placed = (id, bx) => (bx ? [["body", bx.body], ...Object.entries(bx.parts)] : []).map(([k, [mn, mx]]) => {
  const c = Math.cos(bx.rot), s = Math.sin(bx.rot);
  const quad = [[mn[0], mn[2]], [mx[0], mn[2]], [mx[0], mx[2]], [mn[0], mx[2]]].map(([x, z]) => [x * c + z * s + bx.at[0], -x * s + z * c + bx.at[2]]);
  const xs = quad.map((q) => q[0]), zs = quad.map((q) => q[1]);
  return { id, k, quad, y: [mn[1] + bx.at[1], mx[1] + bx.at[1]], min: [Math.min(...xs), mn[1] + bx.at[1], Math.min(...zs)], max: [Math.max(...xs), mx[1] + bx.at[1], Math.max(...zs)] };
});
// do two placed boxes overlap by more than T (separating axes of the two footprints, then the heights)?
const overlap = (a, c, T = 0.005) => {
  if (a.y[0] >= c.y[1] - T || c.y[0] >= a.y[1] - T) return false;
  for (const q of [a.quad, c.quad]) for (let i = 0; i < 4; i++) {
    const [x0, z0] = q[i], [x1, z1] = q[(i + 1) % 4], n = [z1 - z0, x0 - x1], l = Math.hypot(...n);
    const pr = (pts) => pts.map(([x, z]) => (x * n[0] + z * n[1]) / l);
    const pa = pr(a.quad), pc = pr(c.quad);
    if (Math.max(...pa) <= Math.min(...pc) + T || Math.max(...pc) <= Math.min(...pa) + T) return false;
  }
  return true;
};
const clashes = (list) => { const h = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].id !== list[j].id && overlap(list[i], list[j])) h.push(`${list[i].id} ${list[i].k} / ${list[j].id} ${list[j].k}`); return h; };

let b;
const sr = (expr) => b.evalJS(`window.__showroom.${expr}`);
const slotOf = async (id) => (await sr("slots()")).find((s) => s.id === id);
const ready = () => b.waitFor("!!window.__showroom && !document.getElementById('loading')", 60000);
const settle = async () => { await sleep(150); await b.waitFor("!window.__showroom.camera().flying", 30000); await sleep(250); };
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
const tags0 = await sr("labels()");
check(tags0.length > 0 && tags0.length <= 14 && !(await tagsUnderUI()).length, `with no card open, name tags on the ${tags0.length} products nearest in your aisle, none under the page's buttons`);
// it opens at eye height just inside the entrance, after a slow step in, looking down the middle aisle
await settle();
const cam0 = await sr("camera()");
const mid = lay.aisles[Math.floor((lay.aisles.length - 1) / 2)];
check(Math.abs(cam0.pos[1] - 1.6) < 0.05 && cam0.pos[2] > 0 && cam0.pos[2] < 1.5 && Math.abs(cam0.pos[0] - mid.mid) < 0.3 && cam0.target[2] < cam0.pos[2] - 3, `it opens at eye height inside the entrance, down the middle aisle (camera ${cam0.pos})`);
const ft = await sr("frameTime(20)");
console.log(`       a frame there: ${ft.ms} ms in this headless browser's software renderer (polished floor ${ft.polished ? "on" : "off"}${ft.dropped ? ", dropped for speed" : ""}), ${await sr("draws()")} draw calls`);
check(ft.ms < 400, `a frame at the entrance draws in ${ft.ms} ms here (software rendering; a laptop's GPU is many times faster)`);

console.log("\n[the walls' colours and light]");
// each painted surface, read back off the screen where nothing lights it, is its colour from the client's palette;
// under a scallop of the wall-wash the greige is brighter and warmer but still greige
const sw = await sr("swatches()"), off = (s) => Math.max(...s.clear.got.map((v, i) => Math.abs(v - s.want[i])));
for (const s of sw) check(s.clear && off(s) <= 4, `${s.name}: ${s.clear ? `rgb(${s.clear.got}) on screen at ${s.clear.at.map((v) => v.toFixed(1))}, painted ${s.hex} (off by ${off(s)})` : `no clear spot of the ${s.tried} tried`}`);
const gw = sw.find((s) => s.name === "greige wall");
const gwOk = gw?.washed && gw.washed.got.every((v, i) => v >= gw.want[i] + 4 && v <= 250) && gw.washed.got[0] - gw.washed.got[2] > gw.want[0] - gw.want[2];
check(gwOk, `in a scallop's beam the greige wall reads rgb(${gw?.washed?.got}): lit warmer and brighter, not washed out`);
const unw = await sr("unwashed()");
check(!unw.length, `a scallop of light on the wall or partition behind every product${unw.length ? `; not over ${unw.slice(0, 3).join(", ")}` : ""}`);
{
  const fx0 = await sr("fixtures()"), plan0 = await sr("plan()"), units = plan0.filter((p) => p.wall).length;
  const hit0 = (a, c, tol) => a.min[0] < c.max[0] - tol && c.min[0] < a.max[0] - tol && a.min[1] < c.max[1] - tol && c.min[1] < a.max[1] - tol && a.min[2] < c.max[2] - tol && c.min[2] < a.max[2] - tol;
  const lr = fx0.filter((f) => f.tag === "living room"), plates = fx0.filter((f) => f.tag === "name plate");
  const bad = [];
  for (const f of lr) {
    for (const p of plan0) if (p.boxes.some((x) => hit0(f, x, 0.002))) bad.push(p.id);
    for (const g of fx0) if (g.tag !== "living room" && hit0(f, g, 0.002)) bad.push(g.tag);
  }
  check(!units || (lr.length > 20 && plates.length === units && !bad.length), `the air conditioners' wall is a living room (${lr.length} pieces: prints, a sofa, a lamp, a plant, a sideboard), clear of every unit, its name plate (${plates.length}) and talker${bad.length ? `; touches ${[...new Set(bad)].slice(0, 3).join(", ")}` : ""}`);
}
// the walk keys: up walks forward at eye height, in the walkway; left turns where you stand; with the search box
// focused they do nothing. (Held 1.5 s; this headless browser draws only a few frames a second when nothing moves,
// and the page's timer keeps the steps coming.)
const hold = async (code, key, ms = 1500) => {
  await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", code, key, windowsVirtualKeyCode: { ArrowUp: 38, ArrowLeft: 37, ArrowDown: 40, ArrowRight: 39 }[code] });
  await sleep(ms);
  await b.send("Input.dispatchKeyEvent", { type: "keyUp", code, key, windowsVirtualKeyCode: { ArrowUp: 38, ArrowLeft: 37, ArrowDown: 40, ArrowRight: 39 }[code] });
  await sleep(700);
};
const yaw = (c) => Math.atan2(c.target[0] - c.pos[0], c.target[2] - c.pos[2]);
await hold("ArrowUp", "ArrowUp");
let cam2 = await sr("camera()");
check(cam2.pos[2] < cam0.pos[2] - 0.15 && Math.abs(cam2.pos[1] - 1.6) < 0.05 && Math.abs(cam2.pos[0] - mid.mid) < 0.3, `the up arrow walks forward down the aisle (${cam0.pos[2]} -> ${cam2.pos[2]} m)`);
await hold("ArrowLeft", "ArrowLeft", 800);
const cam3 = await sr("camera()"), turned = Math.abs(Math.atan2(Math.sin(yaw(cam3) - yaw(cam2)), Math.cos(yaw(cam3) - yaw(cam2))));
check(turned > 0.3 && hyp(cam3.pos, cam2.pos) < 0.05, `the left arrow turns you where you stand (${turned.toFixed(2)} rad)`);
await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "/", code: "Slash", windowsVirtualKeyCode: 191 });
await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/", code: "Slash", windowsVirtualKeyCode: 191 });
await sleep(200);
check(await b.evalJS("document.activeElement && document.activeElement.id === 'q'"), `"/" puts you in the search box`);
await hold("ArrowUp", "ArrowUp", 800);
const cam4 = await sr("camera()");
check(hyp(cam4.pos, cam3.pos) < 0.01, "with the search box focused, the arrow keys don't walk");
// search: a model code typed in, Enter: it walks you to that product and opens its card
const Y = products.filter((p) => p.category === "Washing machine").at(-1) || products.at(-1);
await b.evalJS("document.getElementById('q').value = ''");
await b.send("Input.insertText", { text: Y.model });
await sleep(300);
const res = await b.evalJS(`[...document.querySelectorAll("#results .res")].length + " " + !document.getElementById("results").classList.contains("hide") + " " + (document.querySelector("#results .res b")?.textContent || "")`);
check(res.split(" ")[1] === "true" && +res.split(" ")[0] >= 1 && res.split(" ").slice(2).join(" ") === Y.brand, `typing ${Y.model} lists it (${res})`);
await b.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await settle();
{
  const c = await sr("camera()"), sy = await slotOf(Y.id), d = Math.hypot(...c.pos.map((v, i) => v - sy.center[i]));
  check(await sr("selected()") === Y.id && d > 1.2 && d < 3.2 && hyp(c.target, sy.center) < 0.05, `and Enter walks you to ${Y.id}: ${d.toFixed(2)} m from it, looking at it, its card open`);
  check(await b.evalJS("document.getElementById('pcMop').textContent") === "MOP: price coming soon" && await b.evalJS(`document.querySelector('.chip[data-id="${Y.id}"] .mop').textContent`) === "MOP: price coming soon",
    "its card and its chip show the MOP placeholder (no prices in the repo)");
}
// the whole showroom from above
await b.evalJS("document.getElementById('btnOverview').click()");
await settle();
await b.waitFor("window.__showroom.loader().loading === 0", 120000);
await sleep(500);
check((await sr("labels()")).length === 0, "from above the aisle signs name things, not a tag on every product");
const draws = await sr("draws()");
check(draws < 1000, `the whole hall with ${ld.loaded} models loaded is ${draws} draw calls (the room itself merged into a few dozen)`);
await b.shot(`${out}/showroom-overview.png`);

console.log("\n[a chip, a door, the card]");
const chipPt = await center(`.chip[data-id="${X.id}"]`);
await mouse(chipPt[0], chipPt[1]);
await settle();
let card = await sr("card()");
let cam = await sr("camera()");
let sx = await slotOf(X.id);
const camDist = Math.hypot(...cam.pos.map((v, i) => v - sx.center[i]));
check(await sr("selected()") === X.id && card.shown && card.name === X.shortName && card.link === finishPath(X, 0), `the ${X.id} chip opens its card (${card.name}, ${card.link})`);
check(camDist > 1.2 && camDist < 3 && hyp(cam.target, sx.center) < 0.05, `and flies to it: ${camDist.toFixed(2)} m from it, looking at it`);
const labels = await sr("labels()");
const cut = await b.evalJS(`(() => { const st = document.getElementById("stage").getBoundingClientRect();
  return [...document.querySelectorAll("#labels .tag")].filter((t) => t.style.display !== "none").filter((t) => { const r = t.getBoundingClientRect(); return r.top < st.top || r.left < st.left || r.right > st.right; }).length; })()`);
check(!labels.length && !cut, `with its card open the card names it: no name tags crowd the view (${labels.join(", ") || "none"})`);
let under = await tagsUnderUI();
check(!under.length, `no name tag under the buttons, card or dock${under.length ? `: ${under.join(", ")}` : ""}`);
check(await loadedSoon(X.id), "its 3D model loads");
await sleep(600);
check(await b.evalJS(`[...document.querySelectorAll("#pcParts button[data-key]")].length === ${X.parts.length} && [...document.querySelectorAll("#pcParts button")].every((x) => !x.disabled)`), `the card has its ${X.parts.length} part buttons, enabled once loaded`);
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
// (on its top, else the middle of its front: whichever a sign or partition doesn't hide)
const near = slots.filter((s) => s.id !== X.id && byId.get(s.id).placement !== "wall").sort((a, c) => c.center[2] - a.center[2])[0];
pt = null;
for (const p of [[0, sz(byId.get(near.id)).h - 0.01, 0], [0, sz(byId.get(near.id)).h * 0.6, sz(byId.get(near.id)).d / 2], [0, sz(byId.get(near.id)).h * 0.3, sz(byId.get(near.id)).d / 2]]) {
  const at = await sr(`screenOf("${near.id}", ${JSON.stringify(p)})`);
  if (at && (await sr(`hitAt(${at[0]}, ${at[1]})`)) === near.id) { pt = at; break; }
}
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
const boxes = new Map(); // each model's body and open parts, in the hall
for (const id of dock.chips) {
  await b.evalJS(`document.querySelector('.chip[data-id="${id}"]').click()`);
  await settle();
  await sleep(500);
  ld = await sr("loader()");
  worst = Math.max(worst, ld.loaded + ld.loading);
  worstUnder.push(...(await tagsUnderUI()).map((u) => `${id}: ${u}`));
  if (await loadedSoon(id, 90000)) boxes.set(id, await sr(`boxes(${JSON.stringify(id)})`));
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

console.log("\n[no leaks: every model inside its aisle and clear of every other, doors open or shut]");
check(boxes.size === products.length, `every model loaded and measured (${boxes.size} of ${products.length})`);
{
  const T = 0.005, all = [...boxes].flatMap(([id, bx]) => placed(id, bx));
  const slotsNow = await sr("slots()"), lay2 = await sr("layout()");
  const aisleOf = (id) => { const c = slotsNow.find((s) => s.id === id).center; return lay2.aisles.find((a) => c[0] >= a.x[0] && c[0] <= a.x[1]); };
  // the first and last aisles end at the hall's own walls; the rest at a partition's face
  const out = all.filter((x) => { const a = aisleOf(x.id), wall = byId.get(x.id).placement === "wall";
    const lo = a === lay2.aisles[0] ? a.x[0] : a.x[0] + lay2.PT / 2, hi = a === lay2.aisles.at(-1) ? a.x[1] : a.x[1] - lay2.PT / 2;
    return x.min[0] < lo - T || x.max[0] > hi + T || x.min[1] < -T || x.max[1] > (wall ? lay2.WALL_H : lay2.PART_H) || x.max[2] > -T || x.min[2] < -lay2.D; })
    .map((x) => `${x.id} ${x.k} [${x.min}]-[${x.max}]`);
  check(!out.length, `every model and its open parts inside its aisle: off the partitions and walls, on the floor, under the tops${out.length ? `: ${out.slice(0, 3).join("; ")}` : ""}`);
  const hits = clashes(all);
  check(!hits.length, `no model or open part touches another's, with every door in the hall open at once${hits.length ? `: ${hits.slice(0, 4).join("; ")}` : ""}`);
  const moved = [...boxes].filter(([, bx]) => bx?.shift > 0).map(([id, bx]) => `${id} ${Math.round(bx.shift * 1000)} mm`);
  console.log(`       stood forward off the partition (they reach behind their published depth): ${moved.join(", ") || "none"}`);
}

console.log("\n[no z-fighting in the hall]");
{
  const a0 = lay.aisles[0], a1 = lay.aisles.at(-1), lay2 = await sr("layout()");
  const views = [
    ["the whole hall from far out", [0, 30, 40], [0, 0, -lay2.D / 2], false],
    ["from the entrance", [a0.mid, 1.6, 1.5], [a0.mid, 1, -lay2.D], false],
    ["the floor along a side wall", [-lay2.W / 2 + 1.2, 1.2, -2], [-lay2.W / 2, 0, -5]],
    ["the far left corner, low", [-lay2.W / 2 + 0.8, 0.5, -lay2.D + 0.8], [-lay2.W / 2, 0.2, -lay2.D]],
    ["down an aisle, the floor and runner at a slant", [a1.mid, 1.6, -0.5], [a1.mid, 0, -lay2.LEN], false],
    ["the partition ends and their orange edges", [lay2.aisles[0].x[1] + 0.8, 1.4, 1.2], [lay2.aisles[0].x[1], 1.3, 0]],
    ["the back wall and its plaque", [0, 1.7, -lay2.D + 4], [0, 2, -lay2.D]],
    ["a corner of the hall", [lay2.W / 2 - 1, 1.6, -lay2.D + 1.5], [lay2.W / 2, 0.5, -lay2.D]],
  ];
  for (const [what, pos, tgt, seams = true] of views) {
    const f = await sr(`flicker(${JSON.stringify(pos)}, ${JSON.stringify(tgt)})`);
    check(f.flicker < 0.002 && (!seams || f.holes === 0), `${what}: ${(f.flicker * 100).toFixed(2)}% of pixels change when the eye moves 1 mm${seams ? `; ${f.holes} pixels of sky through the walls or floor` : ""}`);
  }
}
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
  // (a loaded machine can take a few seconds to get the tap through the door's swing; one more tap if it never came)
  const opened = async (ms) => { for (let t = 0; t < ms; t += 400) { await sleep(400); if ((await slotOf(X.id)).state[door.key]) return true; } return false; };
  let tapped = await opened(6000);
  if (!tapped) { await finger(pt[0], pt[1]); tapped = await opened(4000); }
  check(tapped, `a finger tap on its ${door.key} opens it`);
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
  await aimDev("left", [-0.2, 1.0, 0], [-0.8, 2.5, 1.5]); // the left hand points up and back, at nothing (and out of view)
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
  check(await b.evalJS(`document.body.classList.contains("in-xr") && ["dock", "minimap", "tourbar", "filters", "results"].every((id) => getComputedStyle(document.getElementById(id)).display === "none")`), "the page's buttons, floor plan, tour bar, filters and search list step aside");
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
    // passthrough opens on the ring holding the product in focus, which need not be the first
    if ((await xi()).set !== k) {
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
    const ang = vis.map((s) => Math.atan2(s.center[0] - O[0], -(s.center[2] - O[2])));
    const rel = ang.map((a) => { let d = a - ang.reduce((t, x) => t + x, 0) / ang.length; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; });
    const arc = (Math.max(...rel) - Math.min(...rel)) * 2.4;
    check(info.set === k && vis.every((s) => byId.get(s.id).category === cat) && ring.every((r, i) => (walls.some((w) => w.id === vis[i].id) ? r > 2 && r < 2.7 : Math.abs(r - 2.4) < 0.05)) && facingYou && arc <= 2 * Math.PI * 2.4 * 0.9 + 0.01,
      `"${info.sets[k]}": ${vis.length} ${cat} in a ring ${Math.min(...ring).toFixed(2)}-${Math.max(...ring).toFixed(2)} m round you, all facing you (set ${info.set} of ${info.sets.length}, from the first to the last ${arc.toFixed(2)} of ${(2 * Math.PI * 2.4 * 0.9).toFixed(2)} m, categories ${[...new Set(vis.map((s) => byId.get(s.id).category))].join("/")}, facing ${facingYou})`);
    // the ones loaded so far: no door of one, open, reaches another or its open doors
    // wait (up to 90 s on a slow machine) for at least two of them to load, so the check is not empty
    let rb = [];
    for (let t0 = Date.now(); Date.now() - t0 < 90000; await sleep(2000)) {
      rb = [];
      for (const s of vis) rb.push(...placed(s.id, await sr(`boxes(${JSON.stringify(s.id)})`)));
      if (new Set(rb.map((x) => x.id)).size >= Math.min(2, vis.length)) break;
    }
    const rh = clashes(rb);
    check(!rh.length && rb.length > 0, `in the ring, the ${new Set(rb.map((x) => x.id)).size} loaded so far stay clear of each other with their doors open${rh.length ? `: ${rh.slice(0, 3).join("; ")}` : ""}`);
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
// ───────────── round 4: filters, the floor plan, the tour and kiosk, the card's colours, food, compare and share,
// deep links, reduced motion, no WebGL, a model that fails, the keyboard ─────────────
{
  const R = `${out}/r4`; fs.mkdirSync(R, { recursive: true });
  // a browser just closed can hold its debugging port for a moment: wait until the port is free before the next one
  const portFree = async (port) => { for (let i = 0; i < 60; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); } catch { return; } await sleep(250); } };
  const r4open = async (url, { port = PORT, view = [1440, 900, false, MAC], flags = [], before = null } = {}) => {
    await portFree(port);
    const br = await launch({ profile: `${R}/prof-${port}-${Math.random().toString(36).slice(2, 7)}`, port, flags });
    await br.viewport(...view);
    if (before) await before(br);
    await br.go(url);
    return br;
  };
  const r4ready = (br) => br.waitFor("!!window.__showroom && !document.getElementById('loading')", 120000);
  const r4sr = (br, e) => br.evalJS(`window.__showroom.${e}`);
  const r4settle = async (br) => { await sleep(200); await br.waitFor("!window.__showroom.camera().flying", 60000); await sleep(300); };
  const specOf = (p, re) => (p.specs || []).find(([k]) => re.test(k))?.[1];
  const starsOf = (p) => { const m = String(specOf(p, /^energy rating$/i) || "").match(/(\d)\s*star/i); return m ? +m[1] : null; };

  console.log("\n[filters]");
  let br = await r4open(`${base}/showroom`);
  check(await r4ready(br), "the showroom opens");
  await br.evalJS("document.getElementById('btnFilters').click()");
  await sleep(300);
  const brand = "LG", nBrand = products.filter((p) => p.brand === brand).length;
  await br.evalJS(`document.querySelector('#filters [data-brand="${brand}"]').click()`);
  await sleep(300);
  let dim = await r4sr(br, "dimmed()"), cnt = await br.evalJS("document.getElementById('fCount').textContent");
  check(dim.length === products.length - nBrand && dim.every((id) => byId.get(id).brand !== brand) && cnt.startsWith(`${nBrand} of ${products.length}`), `${brand}: ${nBrand} stay lit, the other ${dim.length} dim ("${cnt}")`);
  check(await r4sr(br, "veils()") === dim.length, "a veil over each dimmed product");
  await br.evalJS(`document.querySelector('#filters [data-stars="3"]')?.click()`);
  await sleep(300);
  dim = await r4sr(br, "dimmed()");
  const lit = products.filter((p) => !dim.includes(p.id));
  check(lit.length > 0 && lit.every((p) => p.brand === brand && starsOf(p) >= 3), `and 3 stars and up: ${lit.length} lit, each ${brand} with 3 stars or more in its specs`);
  await br.evalJS("document.getElementById('fClear').click()");
  await sleep(300);
  check((await r4sr(br, "dimmed()")).length === 0 && await r4sr(br, "veils()") === 0, "Clear filters lights them all again");
  await br.evalJS("document.getElementById('btnFilters').click()");

  console.log("\n[the floor plan]");
  const lay4 = await r4sr(br, "layout()"), a2 = lay4.aisles[1];
  const mp = await r4sr(br, `mmPoint(${a2.mid}, -5)`);
  check(!!mp, "a laptop shows the floor plan");
  for (const type of ["mousePressed", "mouseReleased"]) await br.send("Input.dispatchMouseEvent", { type, x: mp[0], y: mp[1], button: "left", clickCount: 1 });
  await r4settle(br);
  let c4 = await r4sr(br, "camera()");
  check(Math.abs(c4.pos[0] - a2.mid) < 0.4 && Math.abs(c4.pos[2] + 5) < 0.8 && Math.abs(c4.pos[1] - 1.6) < 0.05, `a tap on it walks you there (aisle 2 at 5 m: camera ${c4.pos})`);

  console.log("\n[the guided tour]");
  await br.evalJS("document.getElementById('btnTour').click()");
  await r4settle(br);
  let t = await r4sr(br, "tour()");
  check(t.on && t.playing && t.at === t.stops[0] && await r4sr(br, "selected()") === t.stops[0] && !(await br.evalJS("document.getElementById('tourbar').classList.contains('hide')")), `Guided tour starts at the first category's first product (${t.stops[0]}), its card open`);
  await br.evalJS("document.getElementById('tourNext').click()");
  await r4settle(br);
  t = await r4sr(br, "tour()");
  const sel = await r4sr(br, "selected()");
  check(t.at === t.stops[1] && sel === t.stops[1] && byId.get(sel).category !== byId.get(t.stops[0]).category, `Next walks to the next aisle's first product (${sel})`);
  await br.evalJS("document.getElementById('tourPlay').click()");
  check(!(await r4sr(br, "tour()")).playing, "Pause pauses it");
  await br.evalJS("document.getElementById('tourStop').click()");
  check(!(await r4sr(br, "tour()")).on && await br.evalJS("document.getElementById('tourbar').classList.contains('hide')"), "and the cross ends it");

  console.log("\n[the card: colour, food, compare, share]");
  const MF = products.find((p) => (p.finishes || []).length > 1 && p.category === "Refrigerator") || products.find((p) => (p.finishes || []).length > 1);
  await br.evalJS(`document.querySelector('.chip[data-id="${MF.id}"]').click()`);
  await r4settle(br);
  await br.waitFor(`window.__showroom.slots().find((s) => s.id === "${MF.id}").loaded`, 120000);
  const loads0 = (await r4sr(br, "loader()")).loads;
  await br.evalJS(`document.querySelector('#pcSwatches button[data-i="1"]').click()`);
  await sleep(500);
  await br.waitFor(`window.__showroom.slots().find((s) => s.id === "${MF.id}").loaded`, 120000);
  check(await r4sr(br, `finish("${MF.id}")`) === 1 && (await r4sr(br, "loader()")).loads > loads0 && await br.evalJS(`document.querySelector('#pcSwatches button[data-i="1"]').getAttribute("aria-pressed")`) === "true",
    `a swatch shows ${MF.id} in ${MF.finishes[1].name}, in place (its model loaded again in that colour)`);
  const href = await br.evalJS("document.getElementById('pcLink').getAttribute('href')");
  check(href === finishPath(MF, 1), `"View in your room" opens the product page's AR for that colour (${href})`);
  // food: a fridge whose model has it
  await br.evalJS(`document.querySelector('.chip[data-id="${X.id}"]').click()`);
  await r4settle(br);
  await br.waitFor(`window.__showroom.slots().find((s) => s.id === "${X.id}").loaded`, 120000);
  const hasFill = await br.evalJS("!!document.querySelector('#pcParts button[data-fill]')");
  if (hasFill) {
    check(await r4sr(br, `stock("${X.id}")`) === 0, "the fridges stand empty, as the product page opens them");
    await br.evalJS("document.querySelector('#pcParts button[data-fill]').click()");
    await sleep(500);
    await br.waitFor(`window.__showroom.slots().find((s) => s.id === "${X.id}").loaded && window.__showroom.stock("${X.id}") > 0`, 120000);
    check(await r4sr(br, `stock("${X.id}")`) > 0 && await br.evalJS("document.querySelector('#pcParts button[data-fill]').textContent") === "Empty the fridge", `Fill the fridge fills ${X.id} (${await r4sr(br, `stock("${X.id}")`)} pieces)`);
  } else check(false, `${X.id}'s card offers Fill the fridge`);
  // a shorter laptop screen: the card, the floor plan, the buttons and the hint never sit on each other
  await br.viewport(1366, 768, false, MAC);
  // (the floor plan steps aside on the resize; a busy machine can take a few seconds to get there)
  const lapCheck = () => br.evalJS(`(() => {
    const els = ["hint", "minimap", "tools", "pcard"].map((id) => document.getElementById(id))
      .filter((e) => e && e.offsetParent && !e.classList.contains("gone") && getComputedStyle(e).visibility !== "hidden").map((e) => [e.id, e.getBoundingClientRect()]);
    const out = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const [a, r] = els[i], [c, u] = els[j];
      if (r.left < u.right && u.left < r.right && r.top < u.bottom && u.top < r.bottom) out.push(a + " / " + c); }
    return out; })()`);
  let lapOv = [];
  for (let i = 0; i < 12; i++) { await sleep(i ? 500 : 800); lapOv = await lapCheck(); if (!lapOv.length) break; }
  check(!lapOv.length, `at 1366x768 with the card open, nothing on screen covers anything else${lapOv.length ? `: ${lapOv.join(", ")}` : ""}`);
  await br.viewport(1440, 900, false, MAC);
  await sleep(500);
  // share: the link to this spot
  await br.evalJS("window.__copied = null; navigator.clipboard.writeText = async (t) => { window.__copied = t; };");
  await br.evalJS("document.getElementById('pcShare').click()");
  await sleep(300);
  const copied = await br.evalJS("window.__copied");
  check(copied === `${new URL(base).origin}/showroom?focus=${X.id}`, `Share this spot copies ${copied}`);
  // compare: this one, then another
  await br.evalJS("document.getElementById('pcCompare').click()");
  await br.evalJS(`document.querySelector('.chip[data-id="${MF.id}"]').click()`);
  await sleep(300);
  const ctext = await br.evalJS("document.getElementById('pcCompare').textContent");
  check(ctext.startsWith("Compare with"), `on a second product the button reads "${ctext}"`);
  await br.evalJS("document.getElementById('pcCompare').click()");
  await br.waitFor("location.pathname === '/compare'", 20000);
  const cu = new URL(await br.evalJS("location.href"));
  check(cu.searchParams.get("a") === X.id && cu.searchParams.get("b") === MF.id, `and opens the two side by side (${cu.pathname}${cu.search})`);
  const e1 = errorsIn(br.logs.filter((l) => !/compare/i.test(l)));
  check(!e1.length, e1.length ? `console errors: ${e1.slice(0, 3).join(" | ")}` : "no console errors");
  br.close();

  console.log("\n[links, the keyboard, reduced motion]");
  const Ylk = products.filter((p) => p.category === "Washing machine").at(-1) || products.at(-1);
  br = await r4open(`${base}/showroom?aisle=2`, { port: PORT + 1 });
  await r4ready(br); await r4settle(br);
  c4 = await r4sr(br, "camera()");
  check(Math.abs(c4.pos[0] - lay4.aisles[1].mid) < 0.3 && Math.abs(c4.target[0] - lay4.aisles[1].mid) < 0.3, `?aisle=2 opens at aisle 2 (camera x ${c4.pos[0]}, aisle ${lay4.aisles[1].mid})`);
  br.close();
  br = await r4open(`${base}/showroom?q=${encodeURIComponent(Ylk.model)}`);
  await r4ready(br); await r4settle(br);
  check(await r4sr(br, "selected()") === Ylk.id, `?q=${Ylk.model} walks to ${Ylk.id}`);
  // Tab reaches every control, in order
  const seen = [];
  await br.evalJS("document.activeElement?.blur()");
  for (let i = 0; i < 40; i++) {
    await br.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    await br.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
    seen.push(await br.evalJS("(document.activeElement.id || document.activeElement.className || document.activeElement.tagName) + ''"));
  }
  const need = ["mmToggle", "btnOverview", "btnTour", "pcClose", "btnFilters", "q"];
  check(need.every((id) => seen.includes(id)) && seen.some((x) => /chip/.test(x)), `Tab reaches the floor plan, the buttons, the card, the filters, the search and the chips (${need.filter((id) => !seen.includes(id)).join(", ") || "all"})`);
  check(need.map((id) => seen.indexOf(id)).every((v, i, a) => !i || v > a[i - 1]), "in the order they stand on the page");
  br.close();
  br = await r4open(`${base}/showroom`, { before: (x) => x.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] }) });
  await r4ready(br);
  await sleep(500);
  c4 = await r4sr(br, "camera()");
  check(!c4.flying && Math.abs(c4.pos[1] - 1.6) < 0.05, `with reduce motion it opens at the door without the step in (camera ${c4.pos})`);
  await br.evalJS(`document.querySelector('.chip[data-id="${X.id}"]').click()`);
  await sleep(150);
  c4 = await r4sr(br, "camera()");
  const sx4 = (await r4sr(br, "slots()")).find((s) => s.id === X.id);
  check(!c4.flying && hyp(c4.target, sx4.center) < 0.05, "and a chip moves you to its product at once, no flight");
  br.close();

  console.log("\n[kiosk: the tour on its own]");
  br = await r4open(`${base}/showroom?kiosk&idle=3`);
  await r4ready(br);
  await br.waitFor("window.__showroom.tour().on", 20000);
  t = await r4sr(br, "tour()");
  check(t.on && t.kiosk, "?kiosk starts the tour after the screen is left alone (3 s here, a minute by default)");
  for (const type of ["mousePressed", "mouseReleased"]) await br.send("Input.dispatchMouseEvent", { type, x: 700, y: 400, button: "left", clickCount: 1 });
  await sleep(300);
  check(!(await r4sr(br, "tour()")).on, "and a touch stops it");
  br.close();

  console.log("\n[a model that won't load]");
  const Z = products.find((p) => p.id !== X.id && p.category === "Refrigerator" && !p.glb.includes(X.id)) || products[1];
  br = await r4open(`${base}/showroom?focus=${Z.id}`, { before: async (x) => {
    x.on("Fetch.requestPaused", (e) => (x.block && e.request.url.includes(Z.glb) ? x.send("Fetch.failRequest", { requestId: e.requestId, errorReason: "Failed" }) : x.send("Fetch.continueRequest", { requestId: e.requestId })));
    x.block = true;
    await x.send("Fetch.enable", { patterns: [{ urlPattern: "*.glb*" }] });
  } });
  await r4ready(br);
  await br.waitFor(`window.__showroom.loader().failed.includes("${Z.id}")`, 60000);
  const zs = (await r4sr(br, "slots()")).find((s) => s.id === Z.id);
  check(zs.stand.shown && !zs.loaded, `${Z.id} fails to load: its stand-in stays`);
  check(!(await br.evalJS("document.getElementById('pcRetry').classList.contains('hide')")), "and its card offers to try again");
  br.block = false;
  await br.evalJS("document.getElementById('pcRetry').click()");
  check(await br.waitFor(`window.__showroom.slots().find((s) => s.id === "${Z.id}").loaded`, 120000), "which loads it");
  const e2 = errorsIn(br.logs);
  check(!e2.length, e2.length ? `console errors: ${e2.slice(0, 3).join(" | ")}` : "no console errors (a failed model is a warning, not an error)");
  br.close();

  console.log("\n[no WebGL]");
  br = await r4open(`${base}/showroom`, { flags: ["--disable-webgl", "--disable-3d-apis"] });
  await br.waitFor("!!document.getElementById('nogl')", 30000);
  check(await br.evalJS("!!document.querySelector('#nogl a[href=\"/\"]') && getComputedStyle(document.getElementById('dock')).display === 'none'"), "without WebGL: a plain message and a link to the catalogue, no empty 3D page");
  const e3 = errorsIn(br.logs);
  check(!e3.length, e3.length ? `console errors: ${e3.slice(0, 3).join(" | ")}` : "and no console errors");
  br.close();

  console.log("\n[phone: the floor plan and filters]");
  br = await r4open(`${base}/showroom`, { view: [390, 844, true, IPHONE], port: PORT + 1 });
  await r4ready(br);
  // the corner pieces (hint, floor plan, the buttons, the loading pill) never sit on each other
  const overlaps = () => br.evalJS(`(() => {
    const els = ["hint", "minimap", "tools", "progress"].map((id) => document.getElementById(id))
      .filter((e) => e && e.offsetParent && !e.classList.contains("gone") && !e.classList.contains("hide") && getComputedStyle(e).visibility !== "hidden").map((e) => [e.id, e.getBoundingClientRect()]);
    const out = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const [a, r] = els[i], [c, u] = els[j];
      if (r.left < u.right && u.left < r.right && r.top < u.bottom && u.top < r.bottom) out.push(a + " / " + c); }
    return out; })()`);
  let ov = await overlaps();
  check(!ov.length, `on a phone the hint, floor plan, buttons and loading bar don't overlap${ov.length ? `: ${ov.join(", ")}` : ""}`);
  check(await r4sr(br, "mmPoint(0, -5)") === null && await br.evalJS("!!document.getElementById('mmToggle').offsetParent"), "on a phone the floor plan starts folded, with a button to open it");
  await br.evalJS("document.getElementById('mmToggle').click()");
  check(Array.isArray(await r4sr(br, "mmPoint(0, -5)")), "which opens it");
  for (let i = 0; i < 12 && (ov = await overlaps()).length; i++) await sleep(250);
  check(!ov.length, `opened, it overlaps nothing either${ov.length ? `: ${ov.join(", ")}` : ""}`);
  check(await br.evalJS("!!document.getElementById('btnFilters').offsetParent && document.documentElement.scrollWidth <= innerWidth"), "the filters button is there and nothing is wider than the screen");
  await br.shot(`${R}/phone.png`);
  const e4 = errorsIn(br.logs);
  check(!e4.length, e4.length ? `console errors: ${e4.slice(0, 3).join(" | ")}` : "no console errors on the phone");
  br.close();
}
// ───────────── growth: the hall lays itself out again for a much bigger catalogue ─────────────
// Served a bigger products.json (the real list, 40 clones with new ids, models and item codes, a new category with no
// sign artwork of its own, and a hidden product) in place of the real one, only in this browser.
{
  const G = `${out}/growth`; fs.mkdirSync(G, { recursive: true });
  const real = await (await fetch(`${base}/products.json`)).json();
  const shown = real.products.filter((p) => !p.hidden);
  const tag = (p, k, extra = {}) => ({ ...structuredClone(p), id: `${p.id}-${k}`, model: `${p.model}${k.toUpperCase()}`,
    finishes: (p.finishes || []).map((f) => ({ ...f, itemCode: f.itemCode && `${f.itemCode}${k.toUpperCase()}`, code: f.code && `${f.code}${k.toUpperCase()}` })), ...extra });
  const clones = shown.slice(0, 40).map((p) => tag(p, "x2"));
  const small = shown.filter((p) => p.placement !== "wall").sort((a, c) => parseFloat(a.size.h) - parseFloat(c.size.h)).slice(0, 4);
  const micro = [...Array(10)].map((_, i) => tag(small[i % small.length], `mw${i}`, { category: "Microwave", hidden: false }));
  const hidden = tag(shown[0], "hid", { hidden: true });
  const body = Buffer.from(JSON.stringify({ ...real, products: [...real.products, ...clones, ...micro, hidden] })).toString("base64");
  const N = shown.length + clones.length + micro.length;
  const gopen = async (viewport, port) => {
    for (let i = 0; i < 60; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); } catch { break; } await sleep(250); }
    const g = await launch({ profile: `${G}/prof-${viewport[0]}`, port });
    g.on("Fetch.requestPaused", (e) => (/\/products\.json(\?|$)/.test(e.request.url)
      ? g.send("Fetch.fulfillRequest", { requestId: e.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body })
      : g.send("Fetch.continueRequest", { requestId: e.requestId })));
    await g.send("Fetch.enable", { patterns: [{ urlPattern: "*products.json*" }] });
    await g.viewport(...viewport);
    await g.go(`${base}/showroom`);
    await g.waitFor("!!window.__showroom && !document.getElementById('loading')", 120000);
    return g;
  };
  const gsr = (g, e) => g.evalJS(`window.__showroom.${e}`);
  const gsettle = async (g) => { await sleep(200); await g.waitFor("!window.__showroom.camera().flying", 60000); await sleep(300); };
  const hit = (a, c, tol) => a.min[0] < c.max[0] - tol && c.min[0] < a.max[0] - tol && a.min[1] < c.max[1] - tol && c.min[1] < a.max[1] - tol && a.min[2] < c.max[2] - tol && c.min[2] < a.max[2] - tol;

  console.log(`\n[growth: ${N} products on show (${shown.length} real, ${clones.length} clones, ${micro.length} in a new category), one hidden]`);
  let g = await gopen([1440, 900, false, MAC], PORT);
  const gl = await gsr(g, "layout()"), gs = await gsr(g, "slots()"), ids = new Set(gs.map((s) => s.id));
  check(gs.length === N && [...clones, ...micro].every((p) => ids.has(p.id)), `every product stands in the hall once (${gs.length} of ${N})`);
  check(!ids.has(hidden.id), "the hidden one isn't there");
  check(gl.aisles.some((a) => a.cat === "Microwave"), `the new category gets its own aisle: ${gl.aisles.map((a) => `${a.cat}${a.of > 1 ? ` ${a.part}/${a.of}` : ""} (${a.n})`).join(", ")}`);
  const plan = await gsr(g, "plan()");
  const clash = [];
  for (let i = 0; i < plan.length; i++) for (let j = i + 1; j < plan.length; j++)
    for (const x of plan[i].boxes) for (const y of plan[j].boxes) if (hit(x, y, 0.001)) { clash.push(`${plan[i].id}${x.open ? " (open)" : ""} / ${plan[j].id}${y.open ? " (open)" : ""}`); break; }
  check(!clash.length, `no product or open door reaches another${clash.length ? `: ${clash.slice(0, 3).join(", ")}` : ""}`);
  const outside = plan.filter((p) => { const a = gl.aisles[p.aisle]; return p.boxes.some((x) => x.min[0] < a.x[0] - 0.001 || x.max[0] > a.x[1] + 0.001 || x.max[2] > 0.001 || x.min[2] < -gl.D || x.max[1] > gl.WALL_H); });
  check(!outside.length, `every one, doors open, inside its aisle and the hall${outside.length ? `: ${outside.slice(0, 3).map((p) => p.id).join(", ")}` : ""}`);
  const fx = await gsr(g, "fixtures()");
  const fxp = [];
  for (const f of fx) for (const p of plan) if (p.boxes.some((x) => hit(f, x, 0.002))) fxp.push(`${f.tag} / ${p.id}`);
  check(!fxp.length, `signs, panels, talkers, name plates, the reception, the room sets (the living room's prints, sofa and lamps too), plants and the shop front (${fx.length} pieces) keep clear of every product${fxp.length ? `: ${[...new Set(fxp)].slice(0, 4).join(", ")}` : ""}`);
  const ff = [];
  for (let i = 0; i < fx.length; i++) for (let j = i + 1; j < fx.length; j++) if (fx[i].tag !== fx[j].tag && hit(fx[i], fx[j], 0.002)) ff.push(`${fx[i].tag} / ${fx[j].tag}`);
  check(!ff.length, `and of each other${ff.length ? `: ${[...new Set(ff)].slice(0, 4).join(", ")}` : ""}`);
  const gsw = await gsr(g, "swatches()"), gunw = await gsr(g, "unwashed()");
  const gbad = gsw.filter((s) => !s.clear || Math.max(...s.clear.got.map((v, i) => Math.abs(v - s.want[i]))) > 4);
  check(!gbad.length && !gunw.length, `the new aisles and walls take the same colours (${gsw.map((s) => s.name.split(" ")[0]).join(", ")} as painted) and a scallop over every product${gbad.length ? `; off: ${gbad.map((s) => s.name).join(", ")}` : ""}${gunw.length ? `; no scallop over ${gunw.slice(0, 3).join(", ")}` : ""}`);
  const hb = await gsr(g, "hallBox()");
  const W0 = typeof lay !== "undefined" ? lay.W : 0;
  check(gl.W > W0 && Math.abs(hb.min[0] + gl.W / 2) < 0.1 && Math.abs(hb.max[0] - gl.W / 2) < 0.1 && Math.abs(hb.min[2] + gl.D) < 0.1 && hb.max[1] >= gl.WALL_H - 0.01,
    `the walls, floor and ceiling grow with it: ${W0 || "the real hall's"} m wide becomes ${gl.W} x ${gl.D} m, built ${(hb.max[0] - hb.min[0]).toFixed(2)} x ${(-hb.min[2]).toFixed(2)} m`);
  const C = clones.at(-1);
  await g.evalJS("document.getElementById('q').focus()");
  await g.send("Input.insertText", { text: C.model });
  await sleep(300);
  await g.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await g.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
  await gsettle(g);
  check(await gsr(g, "selected()") === C.id, `search finds the clone ${C.model} and walks to it`);
  await g.evalJS("document.getElementById('btnOverview').click()");
  await gsettle(g);
  await g.waitFor("window.__showroom.loader().loading === 0", 120000);
  await sleep(500);
  const far = [[-gl.W / 2, 0, -gl.D], [gl.W / 2, 0, -gl.D], [-gl.W / 2, gl.WALL_H, -gl.D], [gl.W / 2, gl.WALL_H, -gl.D]];
  const corners = await gsr(g, `project(${JSON.stringify([...far, [-gl.W / 2, 0, 0], [gl.W / 2, 0, 0]])})`);
  check(corners.every(([x, y]) => Math.abs(x) <= 1.02 && Math.abs(y) <= 1.02), "from above the whole hall is still in view");
  const draws = await gsr(g, "draws()");
  check(draws < 1000, `${draws} draw calls from above with ${(await gsr(g, "loader()")).loaded} models loaded (cap 1000)`);
  await g.shot(`${G}/overview.png`);
  const ge = errorsIn(g.logs);
  check(!ge.length, ge.length ? `console errors: ${ge.slice(0, 3).join(" | ")}` : "no console errors");
  g.close();
  g = await gopen([390, 844, true, IPHONE], PORT + 1);
  await g.evalJS("document.getElementById('btnOverview').click()");
  await gsettle(g);
  const pc = await gsr(g, `project(${JSON.stringify(far)})`);
  check(pc.every(([x, y]) => Math.abs(x) <= 1.02 && Math.abs(y) <= 1.02), "on a phone, from above, the far end is in view");
  await g.shot(`${G}/phone-overview.png`);
  const gpe = errorsIn(g.logs);
  check(!gpe.length, gpe.length ? `console errors: ${gpe.slice(0, 3).join(" | ")}` : "no console errors on the phone");
  g.close();
}

console.log(`\n${passed} passed, ${failed} failed checks`);
process.exit(failed ? 1 : 0);
