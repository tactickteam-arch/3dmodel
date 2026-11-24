// Checks the opening turn where test_controls.mjs doesn't (that one has the product page's turn and its stops), and
// the pages' idle cost:
// - the product page: no turn in ?embed, ?kiosk or with "reduce motion"; the 3D files' sizes are asked for only once
//   their list comes near the screen;
// - the showroom: a product you go to (?focus=) turns once on its spot and stands exactly as before, facing its aisle;
//   it never comes within 3 cm of the partition behind it while it turns; a key stops it and it turns back the short
//   way; a unit on the wall doesn't turn; with nothing moving the frame loop stops (no frame callbacks, nothing drawn)
//   and a drag wakes it.
// The turn is off in every page test (cdp.mjs sets window.__noSpin); this one turns it on with ?spin=1.
// Emulation only: headless Chrome (SwiftShader), not a real phone or headset.
// usage: node test_turn.mjs <base url> <out dir> [product id]   (PORT: the browser's debugging port)
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out, idArg] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let failed = 0, passed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };
const products = (await (await fetch(`${base}/products.json`)).json()).products.filter((p) => !p.hidden);
const P = products.find((p) => p.id === idArg) || products.find((p) => p.category === "Refrigerator" && p.placement !== "wall");
const W = products.find((p) => p.placement === "wall");
const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9705) });
await b.viewport(1440, 900, false, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");
// counts the page's frame callbacks and WebGL draws (it wraps what is there; it adds no loop of its own)
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => {
  const c = window.__probe = { raf: 0, draws: 0 }, raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (fn) => raf((t) => { c.raf++; fn(t); });
  for (const P of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) for (const k of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
    const f = P?.prototype[k]; if (f) P.prototype[k] = function (...a) { c.draws++; return f.apply(this, a); };
  }
})();` });
const loaded = "document.querySelector('model-viewer')?.loaded === true";

// ── the product page ──
console.log(`\n[product page: ${P.id}]`);
for (const [q, what] of [["?spin=1&embed", "?embed"], ["?kiosk=1", "?kiosk"]]) {
  await b.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__noSpin = false;" });
  await b.go(`${base}/p/${P.id}${q}`);
  await b.waitFor(loaded, 90000);
  await sleep(2500);
  // (?spin=1 turns it on anywhere, as a test asks; ?embed alone has no turn: checked without it below)
  if (what === "?embed") { await b.go(`${base}/p/${P.id}?embed`); await b.waitFor(loaded, 90000); await sleep(2500); }
  check(!(await b.evalJS("window.__spin.allowed")) && !(await b.evalJS("window.__spin.spinning()")), `no turn in ${what}`);
}
await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await b.go(`${base}/p/${P.id}`);
await b.waitFor(loaded, 90000);
await sleep(2500);
check(!(await b.evalJS("window.__spin.allowed")) && !(await b.evalJS("window.__spin.spinning()")), "no turn with \"reduce motion\"");
await b.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
// the files' sizes: none asked for with the page, all once the list is scrolled to
await b.send("Network.enable");
const heads = [];
b.on("Network.requestWillBeSent", (p) => { if (p.request.method === "HEAD") heads.push(p.request.url); });
await b.viewport(390, 844, true);
await b.go(`${base}/p/${P.id}`);
await b.waitFor(loaded, 90000);
await sleep(2000);
const early = heads.length;
await b.evalJS("document.getElementById('files').scrollIntoView({ block: 'center' })");
// (each "…" is replaced by the size once its answer comes; serve.mjs sends no length, so here it goes blank)
const answered = await b.waitFor("[...document.querySelectorAll('#files .sz')].every((e) => e.textContent !== '…')", 15000);
const sizes = await b.evalJS("[...document.querySelectorAll('#files .sz')].map((e) => e.textContent).join(', ')");
check(early === 0 && heads.length === 1 + P.finishes.length && answered, `the files' sizes are asked for once their list is near the screen (${early} with the page, ${heads.length} after${/MB/.test(sizes) ? `: ${sizes}` : ""})`);
await b.viewport(1440, 900, false);

// ── the showroom ──
const turnOf = () => b.evalJS("JSON.stringify(window.__showroom.turn())").then(JSON.parse);
const slotOf = (id) => b.evalJS(`JSON.stringify(window.__showroom.slots().find((s) => s.id === ${JSON.stringify(id)}))`).then(JSON.parse);
// the model's own frame, in its slot: its turn (degrees) and how far it stands out (metres)
const poseOf = (id) => b.evalJS(`window.__showroom.pose(${JSON.stringify(id)})`).then(JSON.parse);
console.log(`\n[showroom: ${P.id}]`);
await b.go(`${base}/showroom?focus=${encodeURIComponent(P.id)}&spin=1`);
check(await b.waitFor(`window.__showroom?.slots?.().find((s) => s.id === ${JSON.stringify(P.id)})?.loaded`, 120000), "its model loads");
const home = { ry: 0, x: 0, z: (await poseOf(P.id)).shift };
check(await b.waitFor("window.__showroom.turn().on", 30000), "it starts turning once its model is in");
let maxDeg = 0, minGap = Infinity, t;
for (let i = 0; i < 1500; i++) {
  t = await turnOf();
  if (!t.on) break;
  maxDeg = Math.max(maxDeg, t.deg);
  if (t.gap !== null) minGap = Math.min(minGap, t.gap);
  await sleep(150);
}
const end = await poseOf(P.id);
check(!t.on && maxDeg > 340, `it turns once on its spot (to ${maxDeg.toFixed(0)} degrees)`);
check(minGap >= 0.029, `never within 3 cm of the partition behind it (${(minGap * 100).toFixed(1)} cm at the closest)`);
check(end.ry === home.ry && end.z === home.z && end.x === home.x, `and stands exactly as before (turn ${end.ry}, out ${end.z} m; before ${home.ry}, ${home.z})`);
// the loop stops once nothing moves, and wakes for a drag
let idle = false;
for (let i = 0; i < 60 && !idle; i++) { await sleep(500); idle = !(await b.evalJS("window.__showroom.loop().running")); }
const p0 = JSON.parse(await b.evalJS("JSON.stringify(window.__probe)"));
await sleep(3000);
const p1 = JSON.parse(await b.evalJS("JSON.stringify(window.__probe)"));
check(idle && p1.raf === p0.raf && p1.draws === p0.draws, `with nothing moving the frame loop stops (${p1.raf - p0.raf} frame callbacks, ${p1.draws - p0.draws} draws in 3 s)`);
const cv = JSON.parse(await b.evalJS("JSON.stringify(document.querySelector('#stage canvas').getBoundingClientRect())"));
const cx = cv.x + cv.width / 2, cy = cv.y + cv.height / 3;
const cam0 = await b.evalJS("JSON.stringify(window.__showroom.camera())");
await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: cx, y: cy, button: "left", clickCount: 1 });
for (let i = 1; i <= 8; i++) { await b.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: cx + i * 15, y: cy, button: "left", buttons: 1 }); await sleep(60); }
await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: cx + 120, y: cy, button: "left", clickCount: 1 });
await sleep(1500);
const p2 = JSON.parse(await b.evalJS("JSON.stringify(window.__probe)"));
check(p2.draws > p1.draws && (await b.evalJS("JSON.stringify(window.__showroom.camera())")) !== cam0, `a drag wakes it and turns the view (${p2.draws - p1.draws} draws)`);
// a key stops a turn at once, and the product turns back the short way
await b.go(`${base}/showroom?focus=${encodeURIComponent(P.id)}&spin=1`);
await b.waitFor(`window.__showroom?.slots?.().find((s) => s.id === ${JSON.stringify(P.id)})?.loaded`, 120000);
await b.waitFor("window.__showroom.turn().deg > 60", 90000);
await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16 });
await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16 });
const st = await turnOf();
check(st.back || !st.on, `a key stops it at once (at ${st.deg} degrees, turning back: ${st.back})`);
await b.waitFor("!window.__showroom.turn().on", 30000);
const after = await poseOf(P.id);
await sleep(3000);
check(after.ry === home.ry && after.z === home.z && !(await turnOf()).on && !(await turnOf()).pending, `it turns back and stays (turn ${after.ry}, out ${after.z} m)`);
// a unit on the wall doesn't turn
if (W) {
  await b.go(`${base}/showroom?focus=${encodeURIComponent(W.id)}&spin=1`);
  await b.waitFor(`window.__showroom?.slots?.().find((s) => s.id === ${JSON.stringify(W.id)})?.loaded`, 120000);
  await sleep(4000);
  const w = await turnOf();
  check(!w.on && !w.pending && (await poseOf(W.id)).ry === 0, `a unit on the wall (${W.id}) doesn't turn`);
}
// ?kiosk (this browser has the page tests' switch turned off since the product page's checks above), and the page tests
await b.go(`${base}/showroom?kiosk`);
await b.waitFor("window.__showroom?.turn", 60000);
check(!(await turnOf()).allowed, "none in ?kiosk");
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__noSpin = true;" });
await b.go(`${base}/showroom?focus=${encodeURIComponent(P.id)}`);
await b.waitFor("window.__showroom?.turn", 60000);
check(!(await turnOf()).allowed, "no turn in the page tests unless asked (?spin=1)");

const errors = b.logs.filter((l) => /EXC|error/i.test(l));
check(errors.length === 0, `no console errors${errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""}`);
console.log(`\n${passed} passed, ${failed} failed`);
b.close();
process.exit(failed ? 1 : 0);
