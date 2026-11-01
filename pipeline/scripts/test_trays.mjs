// Tests the fridge trays that lift out (BENCHMARK.md section 13). One button and a tap take the shelves, the Fresh 0
// tray and the vegetable drawer out with their food, and put them back. Taking them out with the door shut opens the
// door first; shutting the door puts them back first. The model has a clip for every one-part move, Fill still puts
// every item exactly in its place with the trays out, and the page logs no errors.
// usage: node test_trays.mjs <base url> <out dir> [product id]
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out, id = "lg-glt3426snpz"] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let failed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failed++; };

const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9480) });
await b.viewport(1400, 1000, false);
console.log(`[${id}]`);
await b.go(`${base}/p/${id}`);
await b.waitFor("document.querySelector('model-viewer')?.loaded === true && !!window.__organise?.ready?.()", 60000);
await sleep(1500);

const scene = "(() => { const mv = document.querySelector('model-viewer'); return mv[Object.getOwnPropertySymbols(mv).find((s) => s.description === 'scene')]; })()";
// world z of a node, in metres
const z = async (name) => b.evalJS(`(() => { const n = ${scene}.getObjectByName('${name}'); return n ? n.getWorldPosition(n.position.clone()).z : null; })()`);
const state = async () => JSON.parse(await b.evalJS("JSON.stringify(window.__demo.state)"));
const label = () => b.evalJS("document.querySelector('#part-trays span')?.textContent");
const press = (k) => b.evalJS(`document.getElementById('part-${k}').click()`);
const slide = (await b.evalJS("JSON.stringify(window.__demo.product.parts.find((p) => p.key === 'trays')?.slide)")) || "null";
check(slide !== "null", `the product has a trays part (slide ${slide})`);
const dz = JSON.parse(slide)?.[2] ?? 0;

// clips: Rest plus one per single-part move
const names = JSON.parse(await b.evalJS("JSON.stringify(document.querySelector('model-viewer').availableAnimations)"));
const n = (await b.evalJS("window.__demo.product.parts.length"));
const want = [];
for (let s = 0; s < 2 ** n; s++) for (let i = 0; i < n; i++) { const a = s.toString(2).padStart(n, "0"), c = [...a]; c[i] = c[i] === "1" ? "0" : "1"; want.push(`S${a}_${c.join("")}`); }
check(names[0] === "Rest" && want.every((w) => names.includes(w)) && names.length === want.length + 1, `the model has Rest and all ${want.length} one-part clips (${names.length} clips)`);
check(await label() === "Take out trays", `the button reads "${await label()}"`);

// with the door shut, the trays button opens the door first, then takes them out with their food
const t0 = await z("FridgeTrays"), s0 = await z("Shelf1Stock"), v0 = await z("FreshZoneStock");
await press("trays");
await sleep(3200);
let st = await state();
const t1 = await z("FridgeTrays"), s1 = await z("Shelf1Stock"), v1 = await z("FreshZoneStock");
check(st.fridge && st.trays, `from a shut door: the door opened, then the trays came out (${JSON.stringify(st)})`);
check(Math.abs(t1 - t0 - dz) < 0.003 && Math.abs(s1 - s0 - dz) < 0.003 && Math.abs(v1 - v0 - dz) < 0.003,
  `the trays and their food moved out ${((t1 - t0) * 100).toFixed(1)} cm (shelf food ${((s1 - s0) * 100).toFixed(1)}, drawer ${((v1 - v0) * 100).toFixed(1)})`);
check(await label() === "Put trays back", `the button now reads "${await label()}"`);
await b.shot(`${out}/${id}-trays-out.png`);

// a tap on the trays puts them back, and another takes them out
const spot = async () => JSON.parse(await b.evalJS(`(async () => {
  const { partAt } = await import('/site.js');
  const mv = document.querySelector('model-viewer'), r = mv.getBoundingClientRect(), st = window.__demo.state, p = window.__demo.product;
  for (let fy = 0.25; fy < 0.9; fy += 0.02) for (let fx = 0.2; fx < 0.8; fx += 0.02) {
    const x = r.x + r.width * fx, y = r.y + r.height * fy, h = mv.positionAndNormalFromPoint(x, y);
    if (h && partAt(p, st, h.position) === 'trays') return JSON.stringify({ x, y });
  }
  return 'null';
})()`));
const tap = async ({ x, y }) => { await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await sleep(40); await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); };
for (const [want, words] of [[false, "puts the trays back"], [true, "takes them out again"]]) {
  const at = await spot();
  if (!at) { check(false, `found a spot on the trays to tap (${words})`); continue; }
  await tap(at);
  await sleep(2000);
  st = await state();
  check(st.trays === want && st.fridge, `a tap on the trays ${words} (${JSON.stringify(st)})`);
}

// Fill and Empty with the trays out: every item lands exactly where it was built, in the moved trays
await press("organise");
await sleep(9000);
const local = `JSON.stringify((() => { const s = ${scene}, f = []; s.traverse((n) => n.userData?.stock && f.push(n)); const set = new Set(f);
  return f.filter((n) => { for (let p = n.parent; p; p = p.parent) if (set.has(p)) return false; return true; }).map((n) => [n.visible ? 1 : 0, n.position.x, n.position.y, n.position.z]); })())`;
const full = JSON.parse(await b.evalJS(local));
await press("organise");
await sleep(9000);
await press("organise");
await sleep(11000);
const full2 = JSON.parse(await b.evalJS(local));
const drift = full.reduce((m, r, i) => Math.max(m, ...[1, 2, 3].map((k) => Math.abs(r[k] - full2[i][k]))), 0);
check(full.every((r) => r[0] === 1) && full2.every((r) => r[0] === 1) && drift < 1e-5, `Fill with the trays out: all ${full.length} items in place (drift ${drift.toExponential(1)} m)`);
await b.shot(`${out}/${id}-trays-out-full.png`);

// shutting the door with the trays out puts them back first
st = await state();
if (!st.trays) { await press("trays"); await sleep(2000); }
await press("fridge");
await sleep(3200);
st = await state();
const t2 = await z("FridgeTrays");
check(!st.trays && !st.fridge && Math.abs(t2 - t0) < 0.003, `shutting the door put the trays back first, then shut it (${JSON.stringify(st)}, trays at ${((t2 - t0) * 100).toFixed(1)} cm)`);
await b.shot(`${out}/${id}-shut.png`);

const errs = b.logs.filter((l) => /EXCEPTION|\[error\]|Uncaught/.test(l));
check(errs.length === 0, errs.length ? `console errors: ${errs.slice(0, 2).join(" | ")}` : "no console errors");
b.close();
console.log(`\n${failed} failed checks`);
process.exit(failed ? 1 : 0);
