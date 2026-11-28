// Android without WebXR AR, on every product page: what a phone gets when the browser can't run the page's own AR
// (Chrome without WebXR, Samsung Internet, an in-app browser such as WhatsApp, Instagram, Facebook or a shop's app).
// For every product:
//   - every colour, opened at its own item-code link in Chrome on Android with no WebXR: the AR guide gives Google's
//     Scene Viewer steps (no "Place here"), and its button opens Scene Viewer with that colour's own file
//     (androidFile in site.js; its resources all load), AR first, real size (resizable=false), on the wall for a wall
//     unit and never for a floor one, the product's name and colour as title, a link back to that colour's page and a
//     fallback page; the visit is counted as AR on Android;
//   - in an Android in-app browser (a WebView, "; wv)"): no dead AR button, but "Open in Chrome" (an intent:// link
//     that opens this colour's page in Chrome) and Copy link, and nothing counted as AR;
//   - no console errors.
// Once, on the first product (a colour other than the first where it has one): WhatsApp, Instagram and Facebook's
// in-app browsers get the same Chrome sheet; Samsung Internet gets Scene Viewer; Firefox on Android is told plainly
// and offered Chrome; a phone without the Google app (Chrome then opens the fallback, #no-ar) is told what to install
// and the address is put back; and when WebXR starts but fails, model-viewer's own fallback still opens Scene Viewer
// with the chosen colour's file.
// Emulation only: headless Chrome with Android user agents and the intent:// links caught before they leave the page.
// Nothing here runs Scene Viewer, the Google app, ARCore or a real WebView.
// usage: node test_android_fallback.mjs <base url> <out dir> [product ids... | all]   (PORT: the browser's debugging port)
import fs from "node:fs";
import { launch, sleep } from "./cdp.mjs";
import { androidFile, finishPath, chromeIntent } from "../../site.js";

const [base, out, ...args] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const live = (await (await fetch(`${base}/products.json`)).json()).products.filter((p) => !p.hidden);
const ids = !args.length || args[0] === "all" ? live.map((p) => p.id) : args;
const report = [];
let failed = 0, passed = 0;
const log = (...a) => { const s = a.join(" "); report.push(s); console.log(s); };
const check = (ok, msg) => { log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; };
const errorsIn = (logs) => logs.filter((l) => /EXCEPTION|LOG |\[error\]|Uncaught/.test(l));

const CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const SAMSUNG = "Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36";
const FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0";
const WEBVIEW = "Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36";
const INAPP = {
  WhatsApp: "Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 WhatsApp/2.24.25.78",
  Instagram: "Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 Instagram 356.0.0.41.101 Android (34/14; 450dpi; 1080x2340; samsung; SM-A155F; a15; mt6789; en_IN; 658171052)",
  Facebook: "Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.102 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/489.0.0.66.81;]",
};

const b = await launch({ profile: `${out}/prof`, port: +(process.env.PORT || 9640) });
// Every colour's page loading the full model made the run take hours on a busy Mac. The page's real model loads once
// per product (its first colour in Chrome, where the console is watched with it); elsewhere a one-triangle GLB stands
// in for it: what is checked here (the guide, the links, the files Scene Viewer gets) doesn't depend on it.
const tinyGLB = (() => {
  const json = Buffer.from(JSON.stringify({ asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [0, 0, 0], max: [0.1, 0.1, 0] }], bufferViews: [{ buffer: 0, byteLength: 36 }], buffers: [{ byteLength: 36 }] }));
  const j = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
  const bin = Buffer.from(new Float32Array([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0]).buffer);
  const head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + j.length + 8 + bin.length, 8);
  jh.writeUInt32LE(j.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, j, bh, bin]).toString("base64");
})();
let realModel = true;
await b.send("Fetch.enable", { patterns: [{ urlPattern: "*.glb*", requestStage: "Request" }] });
b.on("Fetch.requestPaused", (e) => (realModel ? b.send("Fetch.continueRequest", { requestId: e.requestId })
  : b.send("Fetch.fulfillRequest", { requestId: e.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "model/gltf-binary" }], body: tinyGLB })).catch(() => {}));
// intent:// links are caught, never followed: a click on a link in the page (its own handlers still run) and
// a.click() on a link outside the page (model-viewer's)
const CATCH = `
  window.__intents = [];
  window.__tracked = [];
  Object.defineProperty(window, "s3dTrack", { configurable: true, get: () => (k, p, d) => window.__tracked.push([k, p, d]), set: () => {} });
  document.addEventListener("click", (e) => { const a = e.target.closest?.("a"); if (a && /^intent:/.test(a.href)) { e.preventDefault(); window.__intents.push(a.href); } }, true);
  { const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (/^intent:/.test(this.href) && !this.isConnected) { window.__intents.push(this.href); return; } return click.call(this); }; }`;
let script = null;
async function device(ua, extra = "") {
  if (script) await b.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: script });
  script = (await b.send("Page.addScriptToEvaluateOnNewDocument", { source: CATCH + extra })).result.identifier;
  await b.viewport(390, 844, true, ua);
}
const NO_XR = `Object.defineProperty(navigator, "xr", { value: undefined, configurable: true });`;
// a phone whose WebXR says AR is there but fails to start it (model-viewer then falls back to Scene Viewer itself)
const BROKEN_XR = `window.XRSession = window.XRSession || class XRSession {}; XRSession.prototype.requestHitTestSource ||= function () {};
  Object.defineProperty(navigator, "xr", { configurable: true, value: { isSessionSupported: async (m) => m === "immersive-ar", requestSession: async () => { throw new Error("emulated: this phone's AR failed to start"); }, addEventListener() {}, removeEventListener() {} } });`;

const linkOf = (p, i) => encodeURI(finishPath(p, i) || `/p/${p.id}`);
async function open(p, i) {
  b.logs.length = 0;
  await b.go(`${base}${linkOf(p, i)}`);
  return b.waitFor("!!window.__demo && document.querySelector('model-viewer')?.src && document.querySelector('model-viewer').canActivateAR !== undefined", 40000);
}
const sheetOf = () => b.evalJS(`({ title: document.getElementById("sheetTitle")?.textContent || "", go: !!document.getElementById("sheetGo"), chrome: document.getElementById("sheetChrome")?.href || null, copy: !!document.getElementById("sheetCopy"),
  text: document.getElementById("sheetBody")?.textContent || "", note: document.querySelector(".g-note")?.textContent || "",
  goClass: document.getElementById("sheetGo")?.className || null,
  chromeFirst: !!document.getElementById("sheetChrome") && !!document.getElementById("sheetGo") && !!(document.getElementById("sheetChrome").compareDocumentPosition(document.getElementById("sheetGo")) & Node.DOCUMENT_POSITION_FOLLOWING) })`);
async function pressAR() {
  await b.evalJS("document.getElementById('btnAR').click()");
  await b.waitFor("!document.getElementById('sheet').classList.contains('hide')", 5000);
  return sheetOf();
}
const fetchOk = async (u) => { try { const r = await fetch(u); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; } catch { return null; } };

// the Scene Viewer link for product p, colour i: everything it must hold, and its file and the file's resources load
async function checkIntent(p, i, intent, page, label) {
  const f = p.finishes[i], wall = p.placement === "wall", bad = [];
  const m = /^intent:\/\/arvr\.google\.com\/scene-viewer\/1\.\d\?([^#]*)#Intent;(.*);end;$/.exec(intent || "");
  if (!m) { check(false, `${label}: no Scene Viewer link (${String(intent).slice(0, 80)})`); return; }
  const q = new URLSearchParams(m[1]), extras = m[2];
  const file = new URL(q.get("file"));
  if (file.origin !== new URL(base).origin || file.pathname !== androidFile(p, i) || file.searchParams.get("v") === null) bad.push(`file ${q.get("file")}`);
  if (q.get("mode") !== "ar_preferred") bad.push(`mode ${q.get("mode")}`);
  if (q.get("resizable") !== "false") bad.push("not locked to real size");
  if ((q.get("enable_vertical_placement") === "true") !== wall) bad.push(wall ? "a wall unit without enable_vertical_placement" : "enable_vertical_placement on a floor product");
  if (!q.get("title")?.startsWith(p.brand) || (p.finishes.length > 1 && !q.get("title").includes(f.name))) bad.push(`title "${q.get("title")}"`);
  if (q.get("link") !== page) bad.push(`link ${q.get("link")} (page ${page})`);
  if (!extras.includes("scheme=https") || !extras.includes("package=com.google.android.googlequicksearchbox") || !extras.includes("action=android.intent.action.VIEW")) bad.push("not the Google app's VIEW intent");
  const fb = decodeURIComponent(/S\.browser_fallback_url=([^;]*)/.exec(extras)?.[1] || "");
  if (!fb || new URL(fb).pathname !== new URL(page).pathname || new URL(fb).hash !== "#no-ar") bad.push(`fallback ${fb}`);
  // the file, and everything it loads, as Scene Viewer would fetch them
  const fileUrl = new URL(file.pathname, base).href;
  const body = await fetchOk(fileUrl);
  let j = null; try { j = JSON.parse(new TextDecoder().decode(body)); } catch {}
  if (!j) bad.push(`${file.pathname} doesn't load`);
  else {
    if (j.extras?.android?.finish !== f.name) bad.push(`${file.pathname} is ${j.extras?.android?.finish}, not ${f.name}`);
    for (const r of [...(j.buffers || []), ...(j.images || [])].filter((x) => x.uri)) {
      const got = await fetchOk(new URL(r.uri, fileUrl).href);
      if (!got) bad.push(`${r.uri} doesn't load`);
      else if (r.byteLength !== undefined && got.length !== r.byteLength) bad.push(`${r.uri}: ${got.length} bytes, the file says ${r.byteLength}`);
    }
  }
  check(!bad.length, `${label}: Scene Viewer opens ${file.pathname}${wall ? " on the wall" : ""} at real size, "${q.get("title")}"${bad.length ? `; ${bad.join("; ")}` : ""}`);
}

const errors = (label) => { const e = errorsIn(b.logs); check(!e.length, e.length ? `${label}: console errors: ${e.slice(0, 2).join(" | ").slice(0, 300)}` : `${label}: no console errors`); };

// ── every product, every colour: Chrome on Android without WebXR ──
await device(CHROME, NO_XR);
for (const id of ids) {
  const p = live.find((x) => x.id === id);
  if (!p) { check(false, `${id}: not on show`); continue; }
  log(`\n[${p.id}] ${p.finishes.length} colour${p.finishes.length > 1 ? "s" : ""}, ${p.placement}`);
  for (let i = 0; i < p.finishes.length; i++) {
    const label = `${p.id} ${p.finishes[i].name}`;
    realModel = i === 0;
    if (!(await open(p, i))) { check(false, `${label}: the page didn't start`); continue; }
    if (realModel && !(await b.waitFor("document.querySelector('model-viewer').loaded === true", 120000))) check(false, `${label}: the model didn't load`);
    const st = await b.evalJS(`({ platform: window.__demo.caps.platform, can: document.querySelector('model-viewer').canActivateAR, path: location.pathname, pressed: [...document.querySelectorAll('#swatches .swatch')].findIndex((s) => s.getAttribute('aria-pressed') === 'true') })`);
    const sheet = await pressAR();
    const ok = st.platform === "android" && st.can && sheet.go && /real size/.test(sheet.title) && !/Place here/.test(sheet.text) && (p.finishes.length < 2 || st.pressed === i) && st.path === linkOf(p, i);
    check(ok, `${label}: ${st.path} opens that colour; the guide "${sheet.title}" gives Scene Viewer's steps${ok ? "" : ` (platform ${st.platform}, AR ${st.can}, Go ${sheet.go}, colour ${st.pressed}, "Place here" ${/Place here/.test(sheet.text)})`}`);
    await b.evalJS("document.getElementById('sheetGo')?.click()");
    await b.waitFor("window.__intents.length > 0", 3000);
    const [intents, tracked, page] = await Promise.all([b.evalJS("window.__intents"), b.evalJS("window.__tracked"), b.evalJS("location.origin + location.pathname + location.search")]);
    await checkIntent(p, i, intents[0], page, label);
    check(intents.length === 1 && tracked.some(([k, pid, d]) => k === "AR" && pid === p.id && d === "android"), `${label}: one link opened, counted as AR on Android (${JSON.stringify(tracked.filter(([k]) => k === "AR"))})`);
    errors(label);
  }
}

realModel = false;
// ── every product: an Android in-app browser ──
log("\n[Android in-app browser (a WebView), every product]");
await device(WEBVIEW);
for (const id of ids) {
  const p = live.find((x) => x.id === id); if (!p) continue;
  const i = p.finishes.length - 1, label = `${p.id} in an app`;
  if (!(await open(p, i))) { check(false, `${label}: the page didn't start`); continue; }
  const st = await b.evalJS("window.__demo.caps.platform");
  const sheet = await pressAR();
  const page = await b.evalJS("location.origin + location.pathname + location.search");
  await b.evalJS("document.getElementById('sheetChrome')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))");
  await sleep(200);
  const [intents, chosen, tracked] = await Promise.all([b.evalJS("window.__intents"), b.evalJS("window.__chromeIntent || null"), b.evalJS("window.__tracked")]);
  const want = chromeIntent(page);
  const ok = st === "android-inapp" && !sheet.go && sheet.copy && /Chrome/.test(sheet.title) && sheet.chrome === want && intents.length === 1 && intents[0] === want && chosen === want && !tracked.some(([k]) => k === "AR");
  check(ok, `${label}: "${sheet.title}", Open in Chrome opens ${new URL(page).pathname} in Chrome, Copy link, no dead AR button${ok ? "" : ` (platform ${st}, Go ${sheet.go}, link ${sheet.chrome}, caught ${intents.join(" ")}, AR counted ${JSON.stringify(tracked)})`}`);
  errors(label);
}

// ── once: other browsers, a phone without the Google app, WebXR that fails ──
const X = live.find((p) => p.id === ids[0]), xi = X.finishes.length > 1 ? 1 : 0;
log(`\n[other Android browsers, on ${X.id} ${X.finishes[xi].name}]`);
for (const [app, ua] of Object.entries(INAPP)) {
  await device(ua);
  await open(X, xi);
  const st = await b.evalJS("window.__demo.caps.platform"), sheet = await pressAR();
  check(st === "android-inapp" && !sheet.go && sheet.copy && /^intent:\/\/.*package=com\.android\.chrome/.test(sheet.chrome || ""), `${app}'s in-app browser: "${sheet.title}", with Open in Chrome and Copy link (${st})`);
  errors(app);
}
{
  // Samsung Internet (the default browser on Samsung phones) can't open the doors in AR, Chrome on the same phone can:
  // Open in Chrome comes first, and Scene Viewer is the second button, saying the doors stay shut there
  await device(SAMSUNG, NO_XR);
  await open(X, xi);
  const st = await b.evalJS("window.__demo.caps.platform"), sheet = await pressAR();
  const here = await b.evalJS("location.origin + location.pathname + location.search");
  const okSheet = st === "android" && X.parts.length > 0 && /Chrome/.test(sheet.title) && sheet.chrome === chromeIntent(here) && sheet.chromeFirst && sheet.go && /\balt\b/.test(sheet.goClass || "") && /shut/.test(sheet.note) && !/Don’t show this again/.test(sheet.text + (await b.evalJS("document.getElementById('sheetFoot').textContent")));
  check(okSheet, `Samsung Internet without WebXR: "${sheet.title}", Open in Chrome first (doors open in AR there), then the quick view that says the doors stay shut, and no "Don't show again"${okSheet ? "" : ` (platform ${st}, Chrome ${sheet.chrome}, first ${sheet.chromeFirst}, go ${sheet.goClass}, note "${sheet.note}")`}`);
  await b.evalJS("document.getElementById('sheetChrome')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))");
  await sleep(200);
  const [ci, chosen] = await Promise.all([b.evalJS("window.__intents"), b.evalJS("window.__chromeIntent || null")]);
  check(ci.length === 1 && ci[0] === chromeIntent(here) && chosen === chromeIntent(here), `Samsung Internet: Open in Chrome opens ${new URL(here).pathname} in Chrome (${ci.join(" ")})`);
  await b.evalJS("window.__intents.length = 0");
  await b.evalJS("document.getElementById('sheetGo')?.click()");
  await b.waitFor("window.__intents.length > 0", 3000);
  check(st === "android" && sheet.go, `Samsung Internet without WebXR: the quick view opens Scene Viewer (${st})`);
  await checkIntent(X, xi, (await b.evalJS("window.__intents"))[0], await b.evalJS("location.origin + location.pathname + location.search"), "Samsung Internet");
  // no Google app: Chrome opens the fallback, this page with #no-ar; the page puts its address back and says what to install
  const before = await b.evalJS("location.pathname");
  await b.evalJS("location.hash = '#no-ar'");
  await b.waitFor("location.hash === '' && document.getElementById('toast').classList.contains('show')", 4000);
  const after = await b.evalJS("({ hash: location.hash, path: location.pathname, toast: document.getElementById('toast').textContent })");
  check(after.hash === "" && after.path === before && /Google app/.test(after.toast), `no Google app: the address is put back and the page says "${after.toast}"`);
  errors("Samsung Internet");
  // "Don't show this again" ticked earlier (in Chrome, say) must not skip the offer of Chrome here
  await open(X, xi);
  await b.evalJS("localStorage.setItem('ar-guide-skip', '1')");
  const again = await pressAR();
  check(/Chrome/.test(again.title) && !!again.chrome, `Samsung Internet with "Don't show again" set: the guide still offers Chrome ("${again.title}")`);
  await b.evalJS("localStorage.removeItem('ar-guide-skip')");
}
{
  await device(FIREFOX, NO_XR);
  await open(X, xi);
  const st = await b.evalJS("window.__demo.caps.platform"), sheet = await pressAR();
  check(st === "android" && !sheet.go && sheet.copy && /isn’t available/.test(sheet.title) && /^intent:\/\/.*package=com\.android\.chrome/.test(sheet.chrome || ""), `Firefox on Android: "${sheet.title}", with Open in Chrome and Copy link`);
  errors("Firefox");
}
{
  await device(CHROME, BROKEN_XR);
  await open(X, xi);
  await b.waitFor("window.__demo.caps.xrAR === true", 5000);
  await b.evalJS("document.getElementById('btnAR').click()");
  await b.waitFor("!document.getElementById('sheet').classList.contains('hide')", 5000);
  await b.evalJS("document.getElementById('sheetGo')?.click()");
  await b.waitFor("window.__intents.length > 0", 8000);
  await checkIntent(X, xi, (await b.evalJS("window.__intents"))[0], await b.evalJS("location.origin + location.pathname + location.search"), "WebXR fails to start, model-viewer falls back");
  // model-viewer reports the failed session itself; anything else is an error of the page
  const e = errorsIn(b.logs).filter((l) => !/emulated: this phone's AR failed to start/.test(l));
  check(!e.length, e.length ? `WebXR failing: console errors: ${e.slice(0, 2).join(" | ")}` : "WebXR failing: no other console errors");
}

log(`\n${passed} passed, ${failed} failed checks`);
fs.writeFileSync(`${out}/report.txt`, report.join("\n"));
b.close();
process.exit(failed ? 1 : 0);
