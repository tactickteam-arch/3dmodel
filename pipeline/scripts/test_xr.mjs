// AR and VR on the product page, product by product, in Meta's WebXR emulator (IWER, a Quest 3), plus what every
// other device is offered:
// - Quest passthrough ("immersive-ar"): the guide opens it; it uses the floor (local-floor); the product stands on
//   the floor at its published size facing you (an air conditioner hangs with its middle at 2.05 m, its back on the
//   wall line); pointing at each door, drawer or lid and pulling the trigger opens it; with everything open nothing
//   goes under the floor (or into the wall behind an air conditioner); the panel changes the colour; pointing at the
//   floor moves it there, still on the floor and facing you; Exit hands the open doors and colour back to the page;
// - VR: a floor and a wall behind it; with every part open (from the panel) nothing goes into the wall or the floor;
// - Apple's AR files: every colour's file (and the -free one of a floor unit) is there;
// - once, on the first product: an iPhone, an iPad and Vision Pro open Apple's AR view with its file at real size
//   (allowsContentScaling=0) and a link back; with more than one product (or "all"), also: an in-app browser on
//   iPhone is told to open Safari, Chrome on Android without WebXR gets Google's AR view, Firefox on Android and a
//   laptop are told plainly what to do (a QR code on the laptop), never left with a dead button;
// - no console errors anywhere.
// Emulation only: headless Chrome, IWER and stand-ins for Apple's and Android's AR; not a real headset or phone.
// usage: node test_xr.mjs <base url> <out dir> <iwer.min.js> [product ids... | all]   (PORT: the browser's debugging port; SHOTS=0: no screenshots)
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";

const [base, out, iwerPath, ...args] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const live = (await (await fetch(`${base}/products.json`)).json()).products;
const ids = !args.length ? ["lg-glt3426snpz"] : args[0] === "all" ? live.filter((p) => !p.hidden).map((p) => p.id) : args;
const many = ids.length > 1;
// screenshots only for a single product, and not with SHOTS=0 (a screenshot inside a session can stall a loaded machine)
const noShots = many || process.env.SHOTS === "0";
const QUEST_UA = "Mozilla/5.0 (X11; Linux x86_64; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/35.2.0.4.53 SamsungBrowser/4.0 Chrome/128.0.6613.137 VR Safari/537.36";
const report = [];
let failed = 0, passed = 0;
const log = (...a) => { const s = a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "); report.push(s); console.log(s); };
const check = (ok, msg) => { log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };
const PORT = +(process.env.PORT || 9453);
const errorsIn = (logs) => logs.filter((l) => /EXCEPTION|\[error\]|Uncaught/.test(l));

let b = await launch({ profile: `${out}/prof`, port: PORT });
await b.viewport(1280, 800, false, QUEST_UA);
await b.send("Page.addScriptToEvaluateOnNewDocument", { source: fs.readFileSync(iwerPath, "utf8") + `
;window.__dev = new IWER.XRDevice(IWER.metaQuest3, { stereoEnabled: false });
window.__dev.installRuntime({ forceInstall: true });` });

// aim a controller from a point at a point (world = the headset's own space here); the ray points down -Z
const aim = (who, from, to) => b.evalJS(`(() => {
  const c = window.__dev.controllers.${who};
  const f = ${JSON.stringify(from)}, t = ${JSON.stringify(to)};
  let x = t[0]-f[0], y = t[1]-f[1], z = t[2]-f[2]; const l = Math.hypot(x,y,z); x/=l; y/=l; z/=l;
  const ax = y, ay = -x, az = 0, w = 1 - z; const n = Math.hypot(ax, ay, az, w);
  c.position.set(f[0], f[1], f[2]);
  if (n < 1e-6) c.quaternion.set(0, 1, 0, 0); else c.quaternion.set(ax/n, ay/n, az/n, w/n);
  return true; })()`);
const trigger = async (who = "right") => {
  await b.evalJS(`window.__dev.controllers.${who}.updateButtonValue('trigger', 1)`); await sleep(250);
  await b.evalJS(`window.__dev.controllers.${who}.updateButtonValue('trigger', 0)`); await sleep(300);
};
const info = () => b.evalJS("window.__xrDebug && window.__xrDebug.info()");
const box = () => b.evalJS("window.__xrDebug && window.__xrDebug.box()");
const showCanvas = () => b.evalJS(`(() => { const c = document.querySelector('canvas[data-engine]'); if (c) c.style.display = '';
  const box = document.querySelector('[data-webxr_runtime]'); if (box) box.style.background = 'linear-gradient(#9aa0a6, #6f6a63)'; return !!c; })()`);
const hand = [0.18, 1.25, -0.25];
const still = async () => { for (let i = 0; i < 40; i++) { const x = await box(); if (x && !x.swinging) return x; await sleep(150); } return box(); };

async function enter(button, label, shoot) {
  await b.evalJS(`document.getElementById('${button}').scrollIntoView({block:'center'})`);
  await sleep(300);
  const r = await b.evalJS(`(() => { const r = document.getElementById('${button}').getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; })()`);
  await b.click(r[0], r[1]);
  // the AR button shows the guide first; its Open button starts the session
  if (await b.waitFor("!!document.getElementById('sheetGo') && !document.getElementById('sheet').classList.contains('hide')", 3000)) {
    await sleep(400);
    if (shoot && !noShots) { log(`${label} guide:`, await b.evalJS("document.getElementById('sheetTitle').textContent")); await b.shot(`${out}/${label}-guide.png`); }
    const g = await b.evalJS("(() => { const r = document.getElementById('sheetGo').getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; })()");
    await b.click(g[0], g[1]);
  }
  const ok = await b.waitFor("!!window.__xrDebug && !!window.__xrDebug.info()", 30000);
  await b.evalJS("window.__dev.position.set(0, 1.6, 0); window.__dev.quaternion.set(0, 0, 0, 1)");
  await aim("left", [-0.3, 1.1, -0.2], [-0.6, 3, -0.5]); // the left hand points up, at nothing
  await sleep(1200);
  await showCanvas();
  return ok;
}
// point at a part from in front of it (then from above, then from the side) until the ray names it, and pull
const pressPart = async (key) => {
  for (const dir of [[0, 0, 1], [0, 0.7, 0.7], [0.7, 0, 0.7], [-0.7, 0, 0.7], [0, 1, 0.05]]) {
    const inf = await info(), at = await b.evalJS(`window.__xrDebug.partWorld(${JSON.stringify(key)})`);
    const c = Math.cos(inf.yaw), s = Math.sin(inf.yaw), d = [dir[0] * c + dir[2] * s, dir[1], -dir[0] * s + dir[2] * c];
    await aim("right", at.map((v, i) => v + d[i] * 0.55), at);
    await sleep(350);
    const h = (await info()).hovers.find(Boolean);
    if (h?.type === "part" && h.key === key) { await trigger(); return true; }
  }
  return false;
};
const waitParts = async (want) => { for (let i = 0; i < 30; i++) { const p = (await info()).parts; if (Object.entries(want).every(([k, v]) => p[k] === v)) return p; await sleep(150); } return (await info()).parts; };

for (const id of ids) {
  const P = live.find((p) => p.id === id);
  if (!P) { check(false, `${id} is in products.json`); continue; }
  const wall = P.placement === "wall", cmv = (v) => parseFloat(v) / 100, S = { w: cmv(P.size.w), h: cmv(P.size.h), d: cmv(P.size.d) };
  log(`\n[${id}: ${P.brand} ${P.shortName}, ${P.size.w} x ${P.size.h} x ${P.size.d}${wall ? ", on the wall" : ""}]`);
  b.logs.length = 0;
  await b.go(`${base}/p/${id}`);
  if (!(await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 90000))) { check(false, "the page loads"); continue; }
  await sleep(800);
  const caps = await b.evalJS("window.__demo.caps");
  check(caps.platform === "quest" && caps.headsetAR && caps.headsetVR && !(await b.evalJS("document.getElementById('btnVR').classList.contains('hide')")), `a Quest is offered passthrough and VR (${caps.platform})`);
  if (!noShots) await b.shot(`${out}/0-page.png`);

  // Apple's AR files, every colour (and the floor unit's -free one, for ?ql=free)
  const files = P.finishes.flatMap((f) => [f.usdz, ...(wall ? [] : [f.usdz.replace(/\.usdz$/, "-free.usdz")])]);
  const missing = [];
  for (const f of files) { const r = await fetch(`${base}${f.startsWith("/") ? "" : "/"}${f}`, { method: "HEAD" }); if (!r.ok || +(r.headers.get("content-length") ?? 1e9) < 100000) missing.push(`${f} ${r.status}`); }
  const banner = await fetch(`${base}/banners/${id}.html`, { method: "HEAD" });
  if (!banner.ok) missing.push(`the Quick Look banner /banners/${id}.html ${banner.status}`);
  check(!missing.length, `Apple's AR file for each of its ${P.finishes.length} colour(s), and its banner, are there${missing.length ? `: missing ${missing.join(", ")}` : ""}`);

  // ── passthrough ──
  if (await enter("btnAR", "AR", !many)) {
    let inf = await info();
    check(inf.spaceType === "local-floor", `passthrough starts on the floor (${inf.spaceType})`);
    let bx = await still();
    const sx = bx.max[0] - bx.min[0], sy = bx.max[1] - bx.min[1], sz = bx.max[2] - bx.min[2];
    const sizeOk = Math.abs(sx - S.w) < 0.015 && Math.abs(sy - S.h) < 0.015 && sz > S.d - 0.015;
    const standOk = wall ? Math.abs((bx.min[1] + bx.max[1]) / 2 - 2.05) < 0.01 && bx.min[2] > -0.006 : Math.abs(bx.min[1]) < 0.006 && Math.abs(inf.holder[1] - bx.floorY) < 1e-6;
    const toYou = Math.abs(Math.sin(Math.atan2(inf.head[0] - inf.holder[0], inf.head[2] - inf.holder[2]) - inf.yaw)) < 0.03;
    check(sizeOk && standOk && toYou, `it ${wall ? "hangs with its middle at 2.05 m and its back on the wall line" : "stands on the floor"}, ${Math.round(Math.hypot(inf.holder[0], inf.holder[2]) * 100)} cm in front of you, facing you, at real size: ${[sx, sy, sz].map((v) => (v * 100).toFixed(1)).join(" x ")} cm (bottom ${(bx.min[1] * 100).toFixed(1)} cm, back ${(bx.min[2] * 100).toFixed(1)} cm)`);
    if (!noShots) await b.shot(`${out}/1-ar-start.png`);
    const want = {};
    for (const q of P.parts || []) {
      if ((await info()).parts[q.key]) { want[q.key] = true; continue; } // already open: an inner part opened it
      const ok = await pressPart(q.key);
      want[q.key] = true;
      for (const k of [].concat(q.needs || [])) want[k] = true;
      const st = await waitParts(want);
      check(ok && st[q.key], `pointing at its ${q.label || q.key} and pulling the trigger opens it${ok ? "" : " (the ray never named it)"}`);
      if (!noShots) await b.shot(`${out}/2-ar-${q.key}-open.png`);
    }
    if ((P.parts || []).length) {
      bx = await still();
      const T = 0.006;
      const bad = wall ? (bx.min[2] < -T ? `its back at ${(bx.min[2] * 100).toFixed(1)} cm, into the wall` : "") : (bx.min[1] < -T ? `its lowest point ${(bx.min[1] * 100).toFixed(1)} cm, under the floor` : "");
      check(!bad, `with everything open nothing goes ${wall ? "into the wall" : "under the floor"}${bad ? `: ${bad}` : ""}`);
    }
    if (P.finishes.length > 1) {
      await aim("right", hand, await b.evalJS("window.__xrDebug.buttonWorld('finish:1')"));
      await sleep(350);
      await trigger();
      await sleep(600);
      check((await info()).finishIndex === 1, `the panel changes the colour to ${P.finishes[1].name}`);
    }
    // move it: point at a floor spot the open parts don't stand in front of (a door open to 135-140 degrees, as on LG
    // front-loaders, covers the spot to the left; pointing through it would rightly close the door instead)
    // a wall unit keeps its hanging height: its box, open parts and all, is where it was before the move (a louvre
    // that swings out and down, or a panel that lifts, moves the open box's middle off 2.05 m; the closed one is checked above)
    const hung = await still();
    let spot, hv;
    for (const s of [[-0.9, 0, -1.6], [0.9, 0, -1.6], [-1.5, 0, -0.9], [1.5, 0, -0.9]]) {
      spot = s;
      await aim("right", hand, spot);
      await sleep(400);
      hv = (await info()).hovers.find(Boolean);
      if (hv?.type === "floor") break;
    }
    await trigger();
    await sleep(500);
    inf = await info();
    bx = await still();
    const yawTo = Math.atan2(-inf.holder[0], -inf.holder[2]); // its front towards your head (at x 0, z 0)
    check(hv?.type === "floor" && Math.hypot(inf.holder[0] - spot[0], inf.holder[2] - spot[2]) < 0.05 && Math.abs(inf.holder[1] - bx.floorY) < 1e-6 && Math.abs(Math.sin(inf.yaw - yawTo)) < 0.05 && (wall ? Math.abs((bx.min[1] + bx.max[1]) / 2 - (hung.min[1] + hung.max[1]) / 2) < 0.01 : true),
      `pointing at the floor and pulling the trigger moves it there, on the floor, facing you (${inf.holder.map((v) => v.toFixed(2))})`);
    if (!noShots) await b.shot(`${out}/3-ar-moved.png`);
    await aim("right", hand, await b.evalJS("window.__xrDebug.buttonWorld('exit:')"));
    await sleep(400);
    await trigger();
    await b.waitFor("!window.__xrDebug", 8000);
    await sleep(1500);
    const page = await b.evalJS("window.__demo.state");
    const fin = await b.evalJS("document.querySelector('#swatches .swatch[aria-pressed=\"true\"]') ? [...document.querySelectorAll('#swatches .swatch')].findIndex((x) => x.getAttribute('aria-pressed') === 'true') : 0");
    check(!(await b.evalJS("!!window.__xrDebug")) && Object.keys(want).every((k) => page[k]) && (P.finishes.length < 2 || fin === 1), `Exit hands back the open doors and the colour (${JSON.stringify(page)}, colour ${fin})`);
    if (!noShots) await b.shot(`${out}/4-page-after.png`);
  } else check(false, "passthrough starts");

  // ── VR ──
  await b.go(`${base}/p/${id}`);
  await b.waitFor("document.querySelector('model-viewer')?.loaded === true", 90000);
  await sleep(800);
  if (await enter("btnVR", "VR", !many)) {
    let bx = await still();
    const ok0 = bx.wallZ != null && (wall ? bx.min[2] > bx.wallZ - 0.001 : bx.min[2] > bx.wallZ + 0.01) && bx.min[1] > -0.006;
    check(ok0, `VR: a floor and a wall behind it, clear of the product (its back ${(bx.min[2] * 100).toFixed(1)} cm, the wall ${(bx.wallZ * 100).toFixed(1)} cm)`);
    if (!noShots) await b.shot(`${out}/v1-vr-start.png`);
    for (const q of P.parts || []) {
      if ((await info()).parts[q.key]) continue;
      await aim("right", hand, await b.evalJS(`window.__xrDebug.buttonWorld(${JSON.stringify(`part:${q.key}`)})`));
      await sleep(350);
      await trigger();
      await sleep(200);
    }
    if ((P.parts || []).length) {
      const st = await waitParts(Object.fromEntries(P.parts.map((q) => [q.key, true])));
      bx = await still();
      check(P.parts.every((q) => st[q.key]) && (wall ? bx.min[2] > bx.wallZ - 0.001 : bx.min[2] > bx.wallZ + 0.005) && bx.min[1] > -0.006,
        `VR: the panel opens all ${P.parts.length} part(s), and open nothing goes into the wall or the floor (back ${(bx.min[2] * 100).toFixed(1)} cm, wall ${(bx.wallZ * 100).toFixed(1)} cm, lowest ${(bx.min[1] * 100).toFixed(1)} cm)`);
      if (!noShots) await b.shot(`${out}/v2-vr-open.png`);
    }
    await b.evalJS("window.__dev.activeSession && window.__dev.activeSession.end()");
    await b.waitFor("!window.__xrDebug", 8000);
    await sleep(800);
  } else check(false, "VR starts");
  const errs = errorsIn(b.logs);
  check(!errs.length, errs.length ? `console errors: ${errs.slice(0, 3).join(" | ")}` : "no console errors");
}
b.close();

// ── every other device, once ──
const X = live.find((p) => p.id === ids[0]);
log(`\n[what every other device is offered, on ${X.id}]`);
const devices = [
  ["iPhone (Safari)", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1", { ar: true }, "ios"],
  ["iPad (Safari)", "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1", { ar: true }, "ios"],
  ["Vision Pro (Safari)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/2.0 Safari/605.1.15", { ar: true, vr: true }, "visionos"],
  ["iPhone, inside another app", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0", { webview: true }, "ios-inapp"],
  // Chrome on Android without WebXR still has Google's Scene Viewer; Firefox has neither
  ["Android phone, Chrome without WebXR", "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", { noxr: true }, "android"],
  ["Android phone, Firefox", "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0", { noxr: true }, "android-none"],
  ["laptop", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", { noxr: true }, "desktop"],
];
let port = PORT + 1;
for (const [name, ua, f, platform] of devices) {
  if (!many && !["ios", "visionos"].includes(platform)) continue;
  const d = await launch({ profile: `${out}/prof-${platform}`, port: port++ });
  const phone = /iPhone|Android/.test(ua), expect = platform === "android-none" ? "android" : platform;
  await d.viewport(phone ? 390 : 1280, phone ? 844 : 800, phone, ua);
  await d.send("Page.addScriptToEvaluateOnNewDocument", { source: `
    ${f.ar ? `{ const sup = DOMTokenList.prototype.supports; DOMTokenList.prototype.supports = function (t) { return t === "ar" || sup.call(this, t); }; }` : ""}
    ${f.webview ? `window.webkit = { messageHandlers: {} };` : ""}
    ${f.noxr ? `Object.defineProperty(navigator, "xr", { value: undefined, configurable: true });` : ""}
    ${f.vr ? `Object.defineProperty(navigator, "xr", { value: { isSessionSupported: async (m) => m === "immersive-vr", requestSession: async () => { throw new Error("emulated"); }, addEventListener() {} }, configurable: true });` : ""}
    window.__ql = null;
    HTMLAnchorElement.prototype.click = function () { if (this.rel === "ar") window.__ql = { href: this.href, img: !!this.querySelector("img") }; };` });
  await d.go(`${base}/p/${X.id}`);
  await d.waitFor("document.querySelector('model-viewer')?.loaded === true", 90000);
  await sleep(800);
  const got = await d.evalJS("window.__demo.caps.platform");
  await d.evalJS("document.getElementById('btnAR').click()");
  await d.waitFor("!document.getElementById('sheet').classList.contains('hide')", 4000);
  await sleep(500);
  const sheet = await d.evalJS(`({ title: document.getElementById("sheetTitle")?.textContent, go: !!document.getElementById("sheetGo"), alt: document.getElementById("sheetAlt")?.textContent || null, copy: !!document.getElementById("sheetCopy"), qr: !!document.querySelector(".g-qr svg"), note: document.querySelector(".g-note")?.textContent || "" })`);
  if (platform === "ios" || platform === "visionos") {
    await d.evalJS("document.getElementById('sheetGo').click()");
    await sleep(600);
    const ql = await d.evalJS("window.__ql");
    const u = ql && new URL(ql.href);
    const file = u?.pathname, hash = u ? new URLSearchParams(u.hash.slice(1)) : null;
    const head = file ? await fetch(`${base}${file}`, { method: "HEAD" }) : null;
    check(got === platform && sheet.go && ql?.img && file === X.finishes[0].usdz && head?.ok && hash.get("allowsContentScaling") === "0" && new URL(hash.get("canonicalWebPageURL")).pathname.startsWith("/p/") && (platform !== "visionos" || sheet.alt),
      `${name}: "${sheet.title}", then Apple's AR view with ${file} (${head?.status}), real size locked, a link back to ${hash && new URL(hash.get("canonicalWebPageURL")).pathname}${platform === "visionos" ? `, and "${sheet.alt}"` : ""}`);
  } else if (platform === "ios-inapp") check(got === platform && !sheet.go && sheet.copy && /Safari/.test(sheet.title), `${name}: "${sheet.title}", with Copy link and no dead AR button`);
  else if (platform === "android") check(got === expect && sheet.go && /real size/.test(sheet.title), `${name}: "${sheet.title}", opening Google's AR view (Scene Viewer)`);
  else if (platform === "android-none") check(got === expect && !sheet.go && sheet.copy && /isn’t available/.test(sheet.title) && /Chrome/.test(sheet.note), `${name}: "${sheet.title}" (${sheet.note.trim().slice(0, 70)}…), with Copy link and no dead AR button`);
  else check(got === platform && !sheet.go && sheet.qr && sheet.copy, `${name}: "${sheet.title}", with a QR code and Copy link`);
  if (!noShots) await d.shot(`${out}/device-${platform}.png`);
  const errs = errorsIn(d.logs);
  check(!errs.length, errs.length ? `${name}: console errors: ${errs.slice(0, 2).join(" | ")}` : `${name}: no console errors`);
  d.close();
}

log(`\n${passed} passed, ${failed} failed checks`);
fs.writeFileSync(`${out}/report.txt`, report.join("\n"));
process.exit(failed ? 1 : 0);
