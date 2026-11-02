// What four customer-view tests found on 1-2 Nov 2026 (an iPhone shopper, an Android shopper on a slow link, a
// salesperson on an iPad, an engineer on a laptop), checked so it stays fixed:
// - the part buttons fit the 3D view (the fridge's five on a 1024 px laptop and a sideways iPad go under it);
// - a press while a part moves waits its turn instead of being lost; two quick presses on one part count once;
//   Fill then "Take out trays" does both;
// - a double-click close-up shows about 30 cm, with "See all of it", and a second double-click goes back;
// - a wall unit has no Back view and turns only as far as its sides;
// - a grey feature number (its spot behind a shut door) can be tapped; hidden dots and cards are out of the Tab order;
// - on a phone the tip sits above the AR bar and Share is by the title; a sideways phone shows the view and its buttons;
// - an unknown product says so, the model number in capitals works, and each shared link previews its own product;
// - back to the catalogue returns to the card that was opened, and cards give W, H and D;
// - no console errors.
// usage: node test_customer.mjs <base url> <out dir>
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
let failed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failed++; };
const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9490) });
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const go = async (url) => { for (let i = 0; i < 3; i++) { await b.go(url); await sleep(600); if (!String(await b.evalJS("location.href")).startsWith("chrome-error")) return; } };
const load = async (id, extra = "") => { await go(`${base}/p/${id}${extra}`); return b.waitFor("document.querySelector('model-viewer')?.loaded === true && (!window.__demo.product.parts.length || true)", 60000).then(async (r) => { await sleep(1800); return r; }); };
const scene = "(() => { const mv = document.querySelector('model-viewer'); return mv[Object.getOwnPropertySymbols(mv).find((s) => s.description === 'scene')]; })()";
const restAt = `(() => { const s = ${scene}; window.__rest = Object.fromEntries(window.__demo.product.parts.map((p) => { const n = s.getObjectByName(p.node); return [p.key, [n.position.clone(), n.quaternion.clone()]]; })); })()`;
const drawn = async () => JSON.parse(await b.evalJS(`JSON.stringify((() => { const s = ${scene}, st = window.__demo.state;
  return window.__demo.product.parts.map((p) => { const n = s.getObjectByName(p.node), [p0, q0] = window.__rest[p.key];
    const moved = p.axis ? 2 * Math.acos(Math.min(1, Math.abs(n.quaternion.dot(q0)))) * 180 / Math.PI / Math.abs(p.angle) : n.position.distanceTo(p0) / Math.hypot(...p.slide);
    return [p.key, +moved.toFixed(2), st[p.key] ? moved > 0.98 : moved < 0.02]; }); })())`));
const center = async (sel) => JSON.parse(await b.evalJS(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 }); })()`));
const tap = async (sel, touch) => { const c = await center(sel); if (touch) { await b.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y }] }); await sleep(40); await b.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); } else { await b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...c, button: "left", clickCount: 1 }); await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...c, button: "left", clickCount: 1 }); } };
const st = async () => JSON.parse(await b.evalJS("JSON.stringify(window.__demo.state)"));
const barFits = async () => JSON.parse(await b.evalJS(`(() => { const s = document.getElementById('stage').getBoundingClientRect(); const bs = [...document.querySelectorAll('#parts button')].map((x) => x.getBoundingClientRect());
  return JSON.stringify({ below: document.getElementById('stage').classList.contains('parts-below'), inside: bs.every((r) => r.left >= s.left - 1 && r.right <= s.right + 1 && r.bottom <= Math.min(s.bottom, innerHeight) + 1), n: bs.length }); })()`));

// 1. the fridge's part bar on a small laptop and an iPad on its side
await b.viewport(1024, 700, false);
await load("lg-glt3426snpz");
let f = await barFits();
check(f.inside && f.n === 5, `1024x700: all ${f.n} part buttons inside the 3D view (under it: ${f.below})`);
await b.shot(`${out}/1024-fridge.png`);
await b.viewport(1440, 900, false); await sleep(800);
f = await barFits();
check(f.inside && !f.below, `1440x900: the part buttons sit over the model in one row (under it: ${f.below})`);
await b.viewport(1180, 820, true, IPAD);
await load("lg-glt3426snpz");
f = await barFits();
check(f.inside, `iPad landscape 1180x820: all part buttons inside the 3D view (under it: ${f.below})`);
await b.shot(`${out}/ipad-land-fridge.png`);

// 2. presses made while a part moves wait their turn
await b.viewport(1280, 800, false);
await load("lg-glt3426snpz");
await b.evalJS(restAt);
await tap("#part-freezer"); await sleep(300); await tap("#part-fridge"); await sleep(3500);
let s = await st(), d = await drawn();
check(s.freezer && s.fridge && d.every((x) => x[2]), `freezer, then fridge 300 ms later: both open and drawn so (${d.map((x) => `${x[0]} ${Math.round(x[1] * 100)}%`).join(", ")})`);
await tap("#part-fridge"); await sleep(150); await tap("#part-fridge"); await sleep(2500);
s = await st(); d = await drawn();
check(!s.fridge && s.freezer && d.every((x) => x[2]), `two presses on "Close fridge" 150 ms apart close it once (fridge open: ${s.fridge})`);
await tap("#part-freezer"); await sleep(2000);
await tap("#part-organise"); await sleep(300); await tap("#part-trays"); await sleep(9000);
s = await st(); d = await drawn();
const full = await b.evalJS("window.__organise.isFull()");
check(full && s.trays && s.fridge && s.freezer && d.every((x) => x[2]), `Fill, then "Take out trays" 300 ms later: full, trays out, doors open (${JSON.stringify(s)})`);
await b.shot(`${out}/fill-trays.png`);
await tap("#part-freezer"); await sleep(250); await tap("#part-icemaker"); await sleep(4000);
s = await st(); d = await drawn();
check(d.every((x) => x[2]), `Close freezer, then ice tray 250 ms later: every part drawn as the page says (${JSON.stringify(s)})`);

// 3. close-up: wider, a way back, and a second double-click goes back
await load("samsung-wa70bg4441bytl");
const r = JSON.parse(await b.evalJS("JSON.stringify(document.querySelector('model-viewer').getBoundingClientRect())"));
const spot = JSON.parse(await b.evalJS(`(() => { const mv = document.querySelector('model-viewer'), r = mv.getBoundingClientRect(); for (let fy = 0.45; fy < 0.8; fy += 0.02) for (let fx = 0.4; fx < 0.6; fx += 0.02) { const x = r.x + r.width * fx, y = r.y + r.height * fy, h = mv.positionAndNormalFromPoint(x, y); if (h && h.normal.z > 0.9) return JSON.stringify({ x, y }); } return 'null'; })()`));
const dbl = async () => { for (let i = 0; i < 2; i++) { await b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...spot, button: "left", clickCount: 1 }); await sleep(30); await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...spot, button: "left", clickCount: 1 }); await sleep(90); } };
const fov0 = await b.evalJS("document.querySelector('model-viewer').getFieldOfView()");
await dbl(); await sleep(1800);
const fov1 = await b.evalJS("document.querySelector('model-viewer').getFieldOfView()");
const allShown = await b.evalJS("!document.getElementById('btnAll').classList.contains('hide')");
await b.shot(`${out}/closeup.png`);
check(spot && fov1 < fov0 / 2 && allShown, `double-click: close up (lens ${fov0.toFixed(1)} -> ${fov1.toFixed(1)} degrees) and "See all of it" shows`);
await dbl(); await sleep(1800);
const fov2 = await b.evalJS("document.querySelector('model-viewer').getFieldOfView()");
check(Math.abs(fov2 - fov0) < 1 && await b.evalJS("document.getElementById('btnAll').classList.contains('hide')"), `a second double-click shows the whole product again (lens ${fov2.toFixed(1)})`);
await dbl(); await sleep(1500); await tap("#btnAll"); await sleep(1500);
check(Math.abs(await b.evalJS("document.querySelector('model-viewer').getFieldOfView()") - fov0) < 1, `"See all of it" shows the whole product`);
check(!(await st()).lid, "none of the double-clicks opened the lid");

// 4. the wall unit stops at its sides, without a Back button
await load("haier-hso52kucai3nb");
check(await b.evalJS("document.querySelector('.view[data-view=back]').offsetParent === null && document.querySelector('model-viewer').maxCameraOrbit.startsWith('100deg')"), "the AC has no Back button and turns at most 100 degrees");

// 5. phone: feature numbers that need a door open still open their card
await b.viewport(390, 844, true, IPHONE);
await load("lg-glt3426snpz");
await tap("#btnShowFeat", true); await sleep(1500);
const away = await b.evalJS("JSON.stringify([...document.querySelectorAll('.flab')].map((x, i) => [i, x.classList.contains('away'), getComputedStyle(x).pointerEvents]))");
const aw = JSON.parse(away).find((x) => x[1]);
if (aw) {
  await tap(`.flab:nth-of-type(${aw[0] + 1})`, true); await sleep(3500);
  const open = await b.evalJS("!document.getElementById('fcard').classList.contains('gone')");
  check(aw[2] === "auto" && open, `a grey feature number (${aw[0] + 1}) can be tapped, and opens its card (${JSON.stringify(await st())})`);
} else check(false, `found a grey feature number (${away})`);
await b.shot(`${out}/phone-feature.png`);
check(await b.evalJS("[...document.querySelectorAll('.hs')].every((x) => x.tabIndex === -1)"), "the dots on the model are out of the Tab order");
await tap("#fcClose", true); await sleep(600);
check(await b.evalJS("document.getElementById('fcard').inert === true"), "the hidden feature card can't be reached with Tab");

// 6. phone: the tip sits above the AR bar
await load("lg-glt3426snpz");
await tap("#part-freezer", true); await sleep(400);
await b.evalJS("document.getElementById('toast').textContent = 'Tap “Fill the fridge” to stock it'; document.getElementById('toast').classList.add('show')"); await sleep(400);
const ov = JSON.parse(await b.evalJS("(() => { const t = document.getElementById('toast').getBoundingClientRect(), a = document.getElementById('arBox').getBoundingClientRect(); return JSON.stringify({ t: t.bottom, a: a.top }); })()"));
check(ov.t <= ov.a, `the tip ends above the AR bar (tip bottom ${Math.round(ov.t)}, bar top ${Math.round(ov.a)})`);
check(await b.evalJS("!!document.getElementById('btnShare') && document.getElementById('btnShare').getBoundingClientRect().top < 1400"), "a Share button sits by the title");

// 7. phone on its side
await b.viewport(740, 360, true, "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36");
await load("samsung-wa70bg4441bytl");
const land = JSON.parse(await b.evalJS(`(() => { const s = document.getElementById('stage').getBoundingClientRect(), bar = document.getElementById('parts').getBoundingClientRect(), a = getComputedStyle(document.getElementById('arBox')).position; return JSON.stringify({ sb: s.bottom, bb: bar.bottom, a, h: innerHeight }); })()`));
check(land.sb <= land.h + 1 && land.bb <= land.h + 1 && land.a !== "fixed", `phone on its side: the 3D view and its buttons fit the screen (view ends ${Math.round(land.sb)}, buttons ${Math.round(land.bb)}, screen ${land.h}), the AR bar doesn't cover it (${land.a})`);
await b.shot(`${out}/phone-landscape.png`);

// 8. links
await b.viewport(1280, 800, false);
await go(`${base}/p/does-not-exist`); await sleep(2500);
const before = b.logs.length;
check(await b.evalJS("document.title") === "Product not found" && /couldn/.test(await b.evalJS("document.body.innerText")), `an unknown product says so, and the tab says "Product not found"`);
await go(`${base}/p/LG-GLT3426SNPZ`); await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 60000);
check(/GLT3426SNPZ/.test(await b.evalJS("document.title")), "the model number in capitals opens the product");

// 9. catalogue: back returns to the card that was opened, and cards say which size is which
await b.viewport(360, 740, true, "Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36");
await go(`${base}/`); await b.waitFor("document.querySelectorAll('#grid .card').length > 2", 20000); await sleep(800);
check(/W \d+ × H \d+ × D \d+ cm/.test(await b.evalJS("document.querySelector('#grid .tags').innerText")), `cards give width, height and depth (${await b.evalJS("document.querySelector('#grid .tags span').innerText")})`);
await b.evalJS("document.querySelectorAll('#grid .card')[3].scrollIntoView({ block: 'center' })"); await sleep(500);
const y0 = await b.evalJS("scrollY");
await tap("#grid .cell:nth-child(4) .card", true);
await b.waitFor("location.pathname.startsWith('/p/')", 15000); await sleep(2500);
await b.evalJS("history.back()"); await sleep(2500);
const y1 = await b.evalJS("scrollY");
check(Math.abs(y1 - y0) < 40 && y0 > 300, `back to the catalogue: at the card that was opened (${Math.round(y0)} -> ${Math.round(y1)} px)`);

// 10. each product's own link preview, in the HTML itself (link previews don't run the page's script)
const shown = (await (await fetch(`${base}/products.json`)).json()).products.filter((p) => !p.hidden);
for (const p of shown) {
  const html = await (await fetch(`${base}/p/${p.id}`)).text();
  const title = (html.match(/<meta property="og:title" content="([^"]*)"/) || [])[1], img = (html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
  check(title?.includes(p.shortName) && img?.endsWith(p.thumb), `${p.id}: a shared link previews "${title}" with its photo`);
}

const errs = b.logs.filter((l) => /EXCEPTION|\[error\]|Uncaught/.test(l));
check(errs.length === 0, errs.length ? `console errors: ${errs.slice(0, 3).join(" | ")}` : "no console errors");
b.close();
console.log(`\n${failed} failed checks`);
process.exit(failed ? 1 : 0);
