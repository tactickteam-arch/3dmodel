// Checks the compare page, /compare?a=<id>&b=<id>:
// - both viewers load, with one lens, distance and target, so the taller product stands taller on screen;
// - a drag or a scroll on either one turns or zooms the other the same way;
// - a part button and a tap on a door open that part, on that side only;
// - the table: Size first, then every label either product lists, "–" where one doesn't;
// - choosing another product: one of the other side's category leaves it alone, one of another category brings it along;
// - with no or one product named, or an unknown one: two of the same category, nearest in size, and the address says so;
// - the phone layout (two columns at 390x844, nothing wider than the screen);
// - the catalogue's way in: the Compare toggles, the bar at the bottom and its link, and the showroom banner;
// - no console errors.
// usage: node test_compare.mjs <base url> <out dir> [a id] [b id]   (PORT picks the browser's debugging port)
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out, aArg, bArg] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let failed = 0, passed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const products = (await (await fetch(`${base}/products.json`)).json()).products.filter((p) => !p.hidden);
// a tall one and a short one with parts, so "same scale" means something
const withParts = (cat) => products.find((p) => p.category === cat && p.parts?.some((x) => x.zone && !x.needs));
const cmH = (p) => parseFloat(p.size.h) / 100;
const A = products.find((p) => p.id === aArg) || withParts("Refrigerator");
// with no washer on show, the shortest other product with parts
const B = products.find((p) => p.id === bArg) || withParts("Washing machine")
  || products.filter((p) => p !== A && p.parts?.some((x) => x.zone && !x.needs)).sort((x, y) => cmH(x) - cmH(y))[0];
// as compare.html: the product most like p (same category, nearest in size)
const gap = (p, q) => ["w", "h", "d"].reduce((t, k) => t + Math.abs(parseFloat(p.size[k]) - parseFloat(q.size[k])), 0);
const nearest = (p) => products.filter((q) => q !== p && q.category === p.category).sort((x, y) => gap(p, x) - gap(p, y))[0];

const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9461) });
const side = (i) => `window.__compare.sides[${i}]`;
const orbit = (i) => b.evalJS(`(() => { const o = ${side(i)}.mv.getCameraOrbit(); return [o.theta, o.phi, o.radius]; })()`);
const same = (o1, o2, tol = 0.01) => o1.every((v, k) => Math.abs(v - o2[k]) < tol);
const rect = (i) => b.evalJS(`(() => { const r = ${side(i)}.mv.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; })()`);
const state = (i) => b.evalJS(`({ ...${side(i)}.state })`);
const loaded = () => b.waitFor("window.__compare && window.__compare.sides.every((s) => !s.mv || s.mv.loaded)", 90000);
const drag = async (x, y, dx, dy) => {
  await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 });
  for (let k = 1; k <= 12; k++) { await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + dx * k / 12, y: y + dy * k / 12, button: "left", buttons: 1 }); await sleep(30); }
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dx, y: y + dy, button: "left", buttons: 0, clickCount: 1 });
};
const tap = async (x, y) => {
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await b.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
};
// screen position of a point in one side's model, through a temporary hotspot (as test_features.mjs)
const screenOf = (i, p) => b.evalJS(`(async () => {
  const mv = ${side(i)}.mv;
  const pos = "${p.map((n) => `${n}m`).join(" ")}";
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let el = mv.querySelector('[slot="hotspot-probe"]');
  if (!el) { el = document.createElement("div"); el.slot = "hotspot-probe"; el.dataset.position = pos; el.dataset.normal = "0 0 1"; mv.appendChild(el); await frame(); }
  else mv.updateHotspot({ name: "hotspot-probe", position: pos });
  const o = mv.getCameraOrbit();
  mv.cameraOrbit = o.theta + 1e-4 + "rad " + o.phi + "rad " + o.radius + "m"; mv.jumpCameraToGoal(); await frame();
  mv.cameraOrbit = o.theta + "rad " + o.phi + "rad " + o.radius + "m"; mv.jumpCameraToGoal(); await frame(); await frame();
  const h = mv.queryHotspot("hotspot-probe"), r = mv.getBoundingClientRect();
  return h ? [r.left + h.canvasPosition.x, r.top + h.canvasPosition.y] : null;
})()`);

console.log(`\n[compare ${A.id} and ${B.id}, desktop 1440x900]`);
for (const path of ["/compare", "/showroom", "/compare/x", "/showroom/x"]) check((await fetch(base + path)).status === 200, `${path} is served`);
await b.viewport(1440, 900);
await b.go(`${base}/compare?a=${A.id}&b=${B.id}`);
check(await loaded(), "both 3D viewers load");
await sleep(1500);
const c = await b.evalJS(`(() => { const c = window.__compare; return { R: c.R, target: c.target, home: c.home, ids: c.sides.map((s) => s.product?.id),
  fov: c.sides.map((s) => s.mv.getFieldOfView()), tg: c.sides.map((s) => { const t = s.mv.getCameraTarget(); return [t.x, t.y, t.z]; }),
  title: document.getElementById("title").textContent, doc: document.title }; })()`);
check(c.ids[0] === A.id && c.ids[1] === B.id, `the two products are ${c.ids.join(" and ")}`);
check(c.title.includes(A.shortName) && c.title.includes(B.shortName) && c.doc.includes(A.model) && c.doc.includes(B.model), `heading "${c.title}"`);
check(Math.abs(c.fov[0] - 30) < 0.5 && Math.abs(c.fov[1] - 30) < 0.5, `one lens: ${c.fov.map((f) => f.toFixed(1)).join(" and ")} degrees`);
const o0 = [await orbit(0), await orbit(1)];
check(same(o0[0], o0[1], 0.002) && Math.abs(o0[0][2] - c.R) < 0.01, `one distance: ${o0.map((o) => o[2].toFixed(3)).join(" and ")} m (R ${c.R})`);
check(same(c.tg[0], c.tg[1], 0.002) && Math.abs(c.tg[0][1] - Math.max(cmH(A), cmH(B)) / 2) < 0.01, `one target: ${JSON.stringify(c.tg[0].map((v) => +v.toFixed(3)))}`);
// on screen, the taller product stands taller by about the ratio of their heights
const hA = await screenOf(0, [0, 0, 0]), tA = await screenOf(0, [0, cmH(A), 0]);
const hB = await screenOf(1, [0, 0, 0]), tB = await screenOf(1, [0, cmH(B), 0]);
const ratio = (hA[1] - tA[1]) / (hB[1] - tB[1]), real = cmH(A) / cmH(B);
check(Math.abs(ratio / real - 1) < 0.12, `same scale: ${A.shortName} is ${ratio.toFixed(2)}x as tall on screen as ${B.shortName} (really ${real.toFixed(2)}x)`);
await b.shot(`${out}/compare-scale.png`);

// a drag on A turns B with it, a drag on B turns A, a scroll on A zooms both
const rA = await rect(0), rB = await rect(1);
await drag(rA[0] + rA[2] / 2, rA[1] + rA[3] / 2, 180, 50);
await sleep(1600);
let oA = await orbit(0), oB = await orbit(1);
check(Math.abs(oA[0] - o0[0][0]) > 0.2 && same(oA, oB), `drag on the left one: both turned to ${oA.map((v) => v.toFixed(3)).join(" ")} (right ${oB.map((v) => v.toFixed(3)).join(" ")})`);
await drag(rB[0] + rB[2] / 2, rB[1] + rB[3] / 2, -260, -30);
await sleep(1600);
const oA2 = await orbit(0), oB2 = await orbit(1);
check(Math.abs(oB2[0] - oB[0]) > 0.2 && same(oA2, oB2), `drag on the right one: both turned to ${oB2.map((v) => v.toFixed(3)).join(" ")} (left ${oA2.map((v) => v.toFixed(3)).join(" ")})`);
await b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: rA[0] + rA[2] / 2, y: rA[1] + rA[3] / 2, deltaX: 0, deltaY: -400 });
await sleep(1600);
oA = await orbit(0); oB = await orbit(1);
check(oA[2] < oA2[2] - 0.05 && same(oA, oB), `scroll on the left one: both zoomed to ${oA[2].toFixed(3)} m (right ${oB[2].toFixed(3)} m)`);
await b.evalJS("document.getElementById('btnReset').click()");
await sleep(1800);
oA = await orbit(0); oB = await orbit(1);
check(same(oA, o0[0], 0.02) && same(oB, o0[1], 0.02), "Reset view puts both back where they started");

// a part button on B opens that part on B only; a tap on A's door opens it on A only
const keyB = B.parts.find((x) => !x.needs).key;
await b.evalJS(`document.querySelector('.col[data-side="b"] .parts button[data-key="${keyB}"]').click()`);
await sleep(1800);
let sA = await state(0), sB = await state(1);
check(sB[keyB] && Object.values(sA).every((v) => !v) && await b.evalJS(`document.querySelector('.col[data-side="b"] .parts button[data-key="${keyB}"]').getAttribute("aria-pressed") === "true"`),
  `the "${keyB}" button opens it on the right only (${JSON.stringify(sB)})`);
const partA = A.parts.find((x) => x.zone && !x.needs);
await b.evalJS(`(() => { const mv = ${side(0)}.mv; mv.cameraOrbit = "0deg 82deg ${c.R}m"; mv.jumpCameraToGoal(); })()`);
await sleep(700);
const [lo, hi] = partA.zone.closed;
const pt = await screenOf(0, [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, hi[2]]);
if (pt) {
  await tap(pt[0], pt[1]);
  await sleep(1800);
  sA = await state(0); sB = await state(1);
  check(sA[partA.key] && Object.keys(sA).filter((k) => sA[k]).length === 1 && sB[keyB], `a tap on the left one's ${partA.key} at ${pt.map(Math.round)} opens it (${JSON.stringify(sA)})`);
} else check(false, `${partA.key}: no screen point`);
await b.shot(`${out}/compare-open.png`);

// the table
const labels = [...new Set([A, B].flatMap((p) => p.specs.map(([k]) => k)))];
const t = await b.evalJS(`(() => { const rows = [...document.querySelectorAll("#specs tbody tr")];
  return { head: [...document.querySelectorAll("#specs thead th")].slice(1).map((x) => x.textContent), rows: rows.map((r) => [r.querySelector("th").textContent, ...[...r.querySelectorAll("td")].map((x) => x.textContent)]) }; })()`);
const size = (p) => `${parseFloat(p.size.w)} × ${parseFloat(p.size.h)} × ${parseFloat(p.size.d)} cm`;
check(t.head[0] === `${A.brand} ${A.shortName}` && t.head[1] === `${B.brand} ${B.shortName}`, `table heads: ${t.head.join(" | ")}`);
check(t.rows[0][0] === "Size (W × H × D)" && t.rows[0][1] === size(A) && t.rows[0][2] === size(B), `Size comes first: ${t.rows[0].join(" | ")}`);
check(t.rows.length === labels.length + 1 && labels.every((k, i) => t.rows[i + 1][0] === k), `then every label either lists, once each (${labels.length})`);
const cellOk = t.rows.slice(1).every(([k, va, vb]) => va === (A.specs.find(([x]) => x === k)?.[1] || "–") && vb === (B.specs.find(([x]) => x === k)?.[1] || "–"));
check(cellOk, `each cell holds that product's value, or "–" (${t.rows.slice(1).filter((r) => r.includes("–")).length} rows with a gap)`);

// choosing another product in a column: one of the other side's category leaves that side alone; one of another
// category brings the other side along, to the one most like it
const ids = () => b.evalJS(`[location.search, ...window.__compare.sides.map((s) => s.product && s.product.id)].join(" ")`);
const choose = async (sd, id) => {
  await b.evalJS(`(() => { const s = document.querySelector('.col[data-side="${sd}"] select'); s.value = "${id}"; s.dispatchEvent(new Event("change")); })()`);
  await sleep(800);
  await loaded();
};
const F2 = products.find((p) => p.category === A.category && p !== A);
await choose("b", F2.id);
check(await ids() === `?a=${A.id}&b=${F2.id} ${A.id} ${F2.id}`, `choosing ${F2.id} (a ${F2.category}) on the right keeps ${A.id} on the left`);
const C = products.find((p) => p.category === "Air conditioner") || products.find((p) => p.category !== A.category);
if (C) {
  await choose("b", C.id);
  check(await ids() === `?a=${nearest(C).id}&b=${C.id} ${nearest(C).id} ${C.id}`, `choosing ${C.id} (another category) brings the left along: ${await ids()}`);
} else console.log(`  (not checked: every product on show is a ${A.category}, so there is no other category to choose)`);

console.log("\n[which two, when the address doesn't say]");
const firstFridge = products.find((p) => p.category === "Refrigerator");
await b.go(`${base}/compare`);
await loaded();
check(await ids() === `?a=${firstFridge.id}&b=${nearest(firstFridge).id} ${firstFridge.id} ${nearest(firstFridge).id}`, `/compare alone shows two fridges of about the same size: ${await ids()}`);
await b.go(`${base}/compare?a=${B.id}`);
await loaded();
check(await ids() === `?a=${B.id}&b=${nearest(B).id} ${B.id} ${nearest(B).id}`, `/compare?a=${B.id} adds the one most like it: ${await ids()}`);
await b.go(`${base}/compare?a=no-such-thing&b=${B.id}`);
await loaded();
await sleep(300);
check(await ids() === `?a=${nearest(B).id}&b=${B.id} ${nearest(B).id} ${B.id}` && await b.evalJS(`document.getElementById("toast").textContent.includes("isn’t in the catalogue")`),
  `an unknown id is replaced by the one most like the other side, with a note: ${await ids()}`);
await b.viewport(1440, 900);
await b.go(`${base}/compare`);
await loaded();
await sleep(1500);
await b.shot(`${out}/compare-desktop.png`);

console.log("\n[phone 390x844]");
await b.viewport(390, 844, true, IPHONE);
await b.go(`${base}/compare`);
check(await loaded(), "both 3D viewers load");
await sleep(1500);
const ph = await b.evalJS(`(() => { const cols = [...document.querySelectorAll(".col")].map((c) => c.getBoundingClientRect());
  const wide = [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; }).map((e) => e.tagName + "." + e.className).slice(0, 3);
  return { cols: cols.map((r) => [Math.round(r.left), Math.round(r.top), Math.round(r.width)]), scroll: document.documentElement.scrollWidth, inner: innerWidth, wide,
    stage: [...document.querySelectorAll(".col .stage")].map((s) => Math.round(s.getBoundingClientRect().height)) }; })()`);
check(ph.cols.length === 2 && ph.cols[0][1] === ph.cols[1][1] && ph.cols[0][0] + ph.cols[0][2] <= ph.cols[1][0] && ph.cols[0][2] > 150, `two columns side by side: ${JSON.stringify(ph.cols)}`);
check(ph.scroll <= ph.inner && !ph.wide.length, `nothing wider than the screen (page ${ph.scroll} px of ${ph.inner}${ph.wide.length ? `; too wide: ${ph.wide.join(", ")}` : ""})`);
check(ph.stage.every((h) => h >= 200), `each 3D view is ${ph.stage.join(" and ")} px tall`);
await b.shot(`${out}/compare-phone.png`);
await b.evalJS("window.scrollTo(0, document.getElementById('specs').getBoundingClientRect().top + scrollY - 80)");
await sleep(400);
await b.shot(`${out}/compare-phone-table.png`);
const ttap = await b.evalJS(`(() => { const r = document.querySelector('.col[data-side="a"] .parts button').getBoundingClientRect(); return r.height; })()`);
check(ttap >= 40, `part buttons are big enough to tap (${Math.round(ttap)} px)`);

console.log("\n[catalogue: Compare toggles, bar, showroom banner]");
await b.viewport(1440, 900);
await b.go(`${base}/`);
await b.evalJS("localStorage.removeItem('compare-picks')"); // picks left by an earlier run
await b.go(`${base}/`);
await b.waitFor("document.querySelectorAll('.card').length > 0");
await sleep(600);
const cat = await b.evalJS(`({ cards: document.querySelectorAll(".card").length, cmp: document.querySelectorAll(".cmp").length, room: document.getElementById("roomLink")?.getAttribute("href"),
  roomShown: !!document.getElementById("roomLink")?.offsetParent, bar: document.getElementById("cbar").classList.contains("show") })`);
check(cat.cmp === cat.cards && cat.cards === products.length, `a Compare toggle on each of the ${cat.cards} cards`);
check(cat.room === "/showroom" && cat.roomShown, "the showroom banner shows and opens /showroom");
check(!cat.bar, "the compare bar is hidden until something is picked");
await b.evalJS(`document.querySelector('.cmp[data-id="${A.id}"]').click()`);
await sleep(300);
const one = await b.evalJS(`({ bar: document.getElementById("cbar").classList.contains("show"), dis: document.getElementById("cgo").getAttribute("aria-disabled"), text: document.querySelector("#picks .empty-pick")?.textContent, pressed: document.querySelector('.cmp[data-id="${A.id}"]').getAttribute("aria-pressed") })`);
check(one.bar && one.dis === "true" && one.text === "Pick one more to compare" && one.pressed === "true", `one pick: the bar shows "${one.text}", its button off`);
await b.evalJS(`document.querySelector('.cmp[data-id="${B.id}"]').click()`);
await sleep(400);
const two = await b.evalJS(`({ href: document.getElementById("cgo").getAttribute("href"), dis: document.getElementById("cgo").getAttribute("aria-disabled"), picks: document.querySelectorAll("#picks .pick").length })`);
check(two.href === `/compare?a=${A.id}&b=${B.id}` && two.dis === "false" && two.picks === 2, `two picks: Compare opens ${two.href}`);
await b.shot(`${out}/catalogue-bar.png`);
const go = await b.evalJS(`(() => { const r = document.getElementById("cgo").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
await b.click(go[0], go[1]);
await sleep(800);
check(await loaded() && await b.evalJS(`location.pathname === "/compare" && window.__compare.sides.map((s) => s.product.id).join() === "${A.id},${B.id}"`), "pressing Compare opens both");
await b.go(`${base}/`);
await b.waitFor("document.querySelectorAll('.card').length > 0");
await sleep(400);
check(await b.evalJS(`document.getElementById("cbar").classList.contains("show") && document.querySelectorAll("#picks .pick").length === 2`), "the picks are still there back on the catalogue");
await b.evalJS("document.getElementById('cclear').click()");
await sleep(300);
check(await b.evalJS(`!document.getElementById("cbar").classList.contains("show") && !document.querySelector('.cmp[aria-pressed="true"]')`), "the X clears them");

const errs = b.logs.filter((l) => /EXCEPTION|\[error\]|Uncaught/.test(l));
check(errs.length === 0, errs.length ? `console errors: ${errs.slice(0, 3).join(" | ")}` : "no console errors");
b.close();
console.log(`\n${passed} passed, ${failed} failed checks`);
process.exit(failed ? 1 : 0);
