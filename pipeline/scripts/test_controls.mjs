// Tests the laptop controls of the product page with real input events: a trackpad swipe turns the model,
// a pinch (Ctrl + wheel) zooms toward the pointer, a mouse wheel zooms and then narrows the lens down to
// 4 degrees, zooming out comes back to the middle of the model, the view buttons and keys work, and a click
// on the empty background leaves the camera where it is.
// usage: node test_controls.mjs <baseUrl> <outDir> [product ids...]
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out, ...args] = process.argv.slice(2);
const ids = args.length ? args : (await (await fetch(`${base}/products.json`)).json()).products.filter((p) => !p.hidden).map((p) => p.id);
fs.mkdirSync(out, { recursive: true });
let failed = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failed++; };
const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9472) });
await b.viewport(1440, 900, false, "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36");

const CAM = `(() => { const mv = document.querySelector('model-viewer'), o = mv.getCameraOrbit(), t = mv.getCameraTarget();
  return JSON.stringify({ theta: o.theta * 180 / Math.PI, phi: o.phi * 180 / Math.PI, r: o.radius, fov: mv.getFieldOfView(), t: [t.x, t.y, t.z] }); })()`;
const cam = async () => { await sleep(900); return JSON.parse(await b.evalJS(CAM)); };
// for a check that something moved: polls until ok(c) or the time is up, as the camera glides slowly on a busy machine
const camUntil = async (ok, ms = 6000) => { const end = Date.now() + ms; let c; do { await sleep(300); c = JSON.parse(await b.evalJS(CAM)); } while (!ok(c) && Date.now() < end); return c; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const sameTarget = (a, b) => a.t.every((v, i) => near(v, b.t[i], 0.005));
const key = async (k, code, vk) => {
  await b.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code, windowsVirtualKeyCode: vk, text: k.length === 1 ? k : undefined });
  await b.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
  await sleep(100);
};

// the opening turn is checked on the first product and the first unit on the wall
const turnWall = (await (await fetch(`${base}/products.json`)).json()).products.find((p) => ids.includes(p.id) && p.placement === "wall")?.id;
for (const id of ids) {
  console.log(`\n[${id}]`);
  b.logs.length = 0;
  await b.go(`${base}/p/${id}`);
  await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 90000);
  await sleep(2500);
  const r = JSON.parse(await b.evalJS("JSON.stringify(document.querySelector('model-viewer').getBoundingClientRect())"));
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const wheel = (dx, dy, mods = 0, x = cx, y = cy) => b.send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: dx, deltaY: dy, modifiers: mods });
  const reset = async () => { await b.evalJS("document.getElementById('btnReset').click()"); await sleep(400); return cam(); };
  const home = await cam();

  for (let i = 0; i < 20; i++) { await wheel(-6.5, 0.5); await sleep(16); }
  let c = await cam();
  check(c.theta < home.theta - 20 && near(c.r, home.r, 0.01) && near(c.fov, home.fov, 0.1), `trackpad swipe turns (${home.theta.toFixed(0)} -> ${c.theta.toFixed(0)} degrees), no zoom`);

  await reset();
  for (let i = 0; i < 15; i++) { await wheel(0, -8, 2, cx - 60, cy); await sleep(16); }
  c = await cam();
  check(c.r < home.r * 0.8 && !sameTarget(c, home), `pinch zooms in toward the pointer (radius ${home.r.toFixed(2)} -> ${c.r.toFixed(2)} m)`);

  await reset();
  await sleep(400);
  for (let i = 0; i < 40; i++) { await wheel(0, -100); await sleep(30); }
  c = await cam();
  check(near(c.fov, 4, 0.05) && c.r < home.r, `mouse wheel zooms in, then narrows the lens to 4 degrees (${c.fov.toFixed(2)})`);
  await b.shot(`${out}/${id}-closeup.png`);
  for (let i = 0; i < 60; i++) { await wheel(0, 100); await sleep(20); }
  c = await cam();
  check(c.r > home.r && near(c.fov, home.fov, 0.1) && sameTarget(c, home), `zooming all the way out stops at a limit (${c.r.toFixed(2)} m) and is centred again`);

  // one click of a Mac mouse wheel (Chrome and Safari send exactly 4.000244140625) is one zoom step, not a turn
  await reset();
  await sleep(400);
  await wheel(0, -4.000244140625);
  c = await camUntil((c) => c.r < home.r * 0.92);
  check(c.r < home.r * 0.92 && near(c.theta, home.theta, 0.5) && near(c.phi, home.phi, 0.5), `a Mac mouse-wheel click zooms one step (${home.r.toFixed(2)} -> ${c.r.toFixed(2)} m), no turn`);

  await reset();
  const views = {};
  // a unit on the wall has no Back button, and turns only as far as its sides
  const wall = await b.evalJS("window.__demo.product.placement === 'wall'");
  const want = { front: (c) => near(c.theta, 0, 1), side: (c) => near(c.theta, -90, 1), back: (c) => near(Math.abs(c.theta), 180, 1), top: (c) => near(c.phi, 20, 1) };
  for (const v of ["front", "side", "back", "top"]) {
    if (wall && v === "back") continue;
    await b.evalJS(`document.querySelector('.controls .view[data-view=${v}]').click()`);
    views[v] = await camUntil(want[v]);
  }
  check(near(views.front.theta, 0, 1) && near(views.side.theta, -90, 1) && (wall || near(Math.abs(views.back.theta), 180, 1)) && near(views.top.phi, 20, 1),
    wall ? "Front, Side and Top buttons turn the view" : "Front, Side, Back and Top buttons turn the view");
  if (wall) {
    const hidden = await b.evalJS("document.querySelector('.controls .view[data-view=back]').offsetParent === null");
    for (let i = 0; i < 14; i++) await key("ArrowRight", "ArrowRight", 39); // 140 degrees asked for
    await sleep(900);
    const t = (await cam()).theta;
    check(hidden && Math.abs(t) <= 101, `a unit on the wall has no Back button and turns no further than its side (${t.toFixed(0)} degrees)`);
  }

  await reset();
  await key("ArrowRight", "ArrowRight", 39);
  await key("ArrowRight", "ArrowRight", 39);
  await key("ArrowUp", "ArrowUp", 38);
  await key("+", "Equal", 187);
  c = await cam();
  check(near(c.theta, home.theta + 20, 1) && near(c.phi, home.phi - 10, 1) && c.r < home.r, "arrow keys turn and + zooms");
  await key("0", "Digit0", 48);
  // the camera glides home, slower on a busy machine
  c = await camUntil((c) => near(c.theta, home.theta, 0.5) && near(c.r, home.r, 0.01));
  check(near(c.theta, home.theta, 0.5) && near(c.r, home.r, 0.01), "0 puts the view back");

  // a click on the empty background used to zoom all the way out
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r.x + 40, y: r.y + r.height - 40, button: "left", clickCount: 1 });
  await sleep(60);
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r.x + 40, y: r.y + r.height - 40, button: "left", clickCount: 1 });
  c = await cam();
  check(near(c.r, home.r, 0.01) && sameTarget(c, home), "a click on the background leaves the camera where it is");

  // after a click in the side panel the arrow keys scroll it, and leave the model alone
  const a = JSON.parse(await b.evalJS("JSON.stringify(document.querySelector('aside').getBoundingClientRect())"));
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: a.x + 12, y: a.y + a.height / 2, button: "left", clickCount: 1 });
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: a.x + 12, y: a.y + a.height / 2, button: "left", clickCount: 1 });
  const top0 = await b.evalJS("document.querySelector('aside').scrollTop");
  await key("ArrowDown", "ArrowDown", 40);
  await key("ArrowDown", "ArrowDown", 40);
  await b.waitFor(`document.querySelector('aside').scrollTop > ${top0}`, 5000); // it scrolls smoothly
  c = await cam();
  const top1 = await b.evalJS("document.querySelector('aside').scrollTop");
  check(near(c.phi, home.phi, 0.5) && top1 > top0, `after a click in the side panel, arrows scroll it (${top0} -> ${top1} px) and the model stays`);

  // a double-click flies to that spot and faces it head-on, and opens nothing
  // back to the viewer with a click on its empty background (a click on the product would open a door)
  const bg = { x: r.x + 40, y: r.y + r.height - 40 };
  await b.send("Input.dispatchMouseEvent", { type: "mousePressed", ...bg, button: "left", clickCount: 1 });
  await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...bg, button: "left", clickCount: 1 });
  await sleep(800);
  if (await b.evalJS("Object.values(window.__demo.state).some(Boolean)")) await b.evalJS("document.querySelectorAll('#parts button').forEach((x) => x.textContent.startsWith('Close') && x.click())");
  await reset(); await sleep(800); // find the spots from the view the double-clicks start from
  // as closeUp() in product.html, a spot counts as the front or a side only within 8 cm of the box's own face, so
  // a side-facing step inside a door near the middle (Haier HES-690GK) isn't taken for the side
  const pts = JSON.parse(await b.evalJS(`(() => { const mv = document.querySelector('model-viewer'); const r = mv.getBoundingClientRect(), c = mv.getBoundingBoxCenter(), d = mv.getDimensions(), out = {};
    for (let fy = 0.2; fy < 0.85; fy += 0.025) for (let fx = 0.2; fx < 0.8; fx += 0.0125) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy, h = mv.positionAndNormalFromPoint(x, y); if (!h) continue;
      const k = h.normal.z > 0.97 ? 'front' : Math.abs(h.normal.x) > 0.97 ? 'side' : null; if (!k) continue;
      const ax = k === 'front' ? 'z' : 'x';
      if (Math.abs(h.position[ax] - (c[ax] + Math.sign(h.normal[ax]) * d[ax] / 2)) >= 0.08) continue;
      const score = Math.abs(h.position.y - c.y);
      if (!out[k] || score < out[k].score) out[k] = { x, y, score, nx: h.normal.x };
    } return JSON.stringify(out); })()`));
  const tap = async (x, y) => { await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }); await sleep(40); await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }); };
  for (const [k, theta] of [["front", 0], ["side", pts.side ? Math.sign(pts.side.nx) * 90 : 0]]) {
    if (!pts[k]) { check(false, `found a spot on the ${k} to double-click`); continue; }
    await reset(); await sleep(800);
    const parts0 = await b.evalJS("JSON.stringify(window.__demo.state)");
    await tap(pts[k].x, pts[k].y); await sleep(90); await tap(pts[k].x, pts[k].y);
    await sleep(1800);
    c = await cam();
    const same = parts0 === await b.evalJS("JSON.stringify(window.__demo.state)");
    const span = 2 * c.r * Math.tan((c.fov * Math.PI) / 360); // what fills the view, in metres (product.html: about 30 cm)
    check(near(c.theta, theta, 1) && near(c.phi, 90, 1) && Math.abs(span - 0.3) < 0.05 && same,
      `a double-click on the ${k} faces it head-on, close up (turn ${c.theta.toFixed(0)}, tilt ${c.phi.toFixed(0)}, ${Math.round(span * 100)} cm across), nothing opens`);
    await b.shot(`${out}/${id}-closeup-${k}.png`);
  }
  // a single click on a part still opens it: test_features.mjs taps every part with real clicks

  // the opening turn (off in tests unless ?spin=1): once the model is in, the view goes once round the product (a wall
  // unit swings to each side and back) and settles exactly where it began; then it stays still. A key (outside the 3D
  // view) stops it for good and the view glides back to the opening view; a press on the 3D view stops it where it is.
  // (Headless Chrome draws in software and each frame turns at most 0.1 s worth, so this waits for the turn instead
  // of timing it.) It takes a minute or two in software, so it runs on the first product and the first wall unit only.
  if (id === ids[0] || id === turnWall) {
    await b.go(`${base}/p/${id}?spin=1`);
    await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 90000);
    const spinning = () => b.evalJS("window.__spin.spinning()");
    check(await b.waitFor("window.__spin?.spinning()", 15000), "the view starts turning on its own once the model is in");
    const t0 = JSON.parse(await b.evalJS(CAM)), thetas = [t0.theta];
    let tilt = true;
    for (let i = 0; i < 900 && !(await b.evalJS("window.__spin.done()")); i++) { await sleep(200); const c = JSON.parse(await b.evalJS(CAM)); thetas.push(c.theta); tilt &&= near(c.phi, t0.phi, 0.5) && near(c.r, t0.r, 0.01); }
    const start = (await b.evalJS("window.__spin.start()")) * 180 / Math.PI, span = Math.max(...thetas) - Math.min(...thetas);
    const end = JSON.parse(await b.evalJS(CAM));
    check(wall ? span > 90 && Math.max(...thetas) < 101 && Math.min(...thetas) > -101 : span > 300, `it goes ${wall ? "to each side and back" : "once round"} (${span.toFixed(0)} degrees), tilt and distance kept: ${tilt}`);
    check(tilt && near(end.theta, start, 0.5) && near(end.phi, t0.phi, 0.5) && near(end.r, t0.r, 0.01) && !(await spinning()), `and settles where it began (${start.toFixed(1)} -> ${end.theta.toFixed(1)} degrees)`);
    await sleep(4000);
    const still = JSON.parse(await b.evalJS(CAM));
    check(!(await spinning()) && near(still.theta, end.theta, 0.1), `then it stays still (${(still.theta - end.theta).toFixed(2)} degrees in 4 s)`);
    await b.go(`${base}/p/${id}?spin=1`);
    await b.waitFor("window.__spin?.spinning()", 90000);
    await camUntil((c) => Math.abs(c.theta - t0.theta) > 20, 30000);
    await key("Shift", "ShiftLeft", 16);
    check(!(await spinning()) && await b.evalJS("window.__spin.done()"), "a key stops it at once");
    const back = await camUntil((c) => near(c.theta, start, 1), 8000);
    check(near(back.theta, start, 1), `and the view glides back to the opening view (${back.theta.toFixed(1)}, began at ${start.toFixed(1)} degrees)`);
    await sleep(9000);
    check(!(await spinning()) && near(JSON.parse(await b.evalJS(CAM)).theta, back.theta, 0.5), "it doesn't start again with nobody touching anything");
    await b.go(`${base}/p/${id}?spin=1`);
    await b.waitFor("window.__spin?.spinning()", 90000);
    await camUntil((c) => Math.abs(c.theta - t0.theta) > 20, 30000);
    await b.send("Input.dispatchMouseEvent", { type: "mousePressed", x: r.x + 8, y: r.y + 8, button: "left", clickCount: 1 });
    const p0 = JSON.parse(await b.evalJS(CAM));
    await b.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: r.x + 8, y: r.y + 8, button: "left", clickCount: 1 });
    await sleep(3000);
    const p1 = JSON.parse(await b.evalJS(CAM));
    check(!(await spinning()) && Math.abs(((p1.theta - p0.theta) % 360 + 540) % 360 - 180) < 2, `a press on the 3D view stops it where it is (${p0.theta.toFixed(1)} -> ${p1.theta.toFixed(1)} degrees)`);
  }

  const errors = b.logs.filter((l) => /EXC|error/i.test(l));
  check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
}
console.log(`\n${failed} failed`);
b.close();
process.exit(failed ? 1 : 0);
