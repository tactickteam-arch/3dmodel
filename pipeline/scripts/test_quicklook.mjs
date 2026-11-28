// iPhone, iPad and Vision Pro AR (Apple's Quick Look), from the product page, in headless Chrome with each Apple
// browser faked: its user agent, platform and touch points, whether it is an app's web view (window.webkit
// .messageHandlers), what relList.supports("ar") answers, Chrome's own script object, and WebXR for Vision Pro. The
// <a rel="ar"> the page clicks is caught, not followed. For every product given (all on show by default):
//  - every colour's link (/p/<item code>, /p/<item code>/<colour>, finishPath in site.js) opens Apple's AR view of that
//    colour's own .usdz, through the help sheet's button and, once the sheet is turned off, straight from AR;
//  - picking each colour on the page, then AR, opens that colour's file; ?ql=free opens its -free copy (floor products);
//  - every link: rel="ar" with one <img> (Safari needs both), the file served as model/vnd.usdz+zip and a zip, the
//    size locked (#allowsContentScaling=0), the banner from the public site (custom=<public origin>/banners/<id>,
//    customHeight=small; the file is there and names this product and its size), and canonicalWebPageURL that
//    colour's public address with at most one query parameter (Safari keeps only the first);
//  - track("AR", "ios" | "visionos") is recorded for each opening;
//  - the browsers: Safari on iPhone; Safari and Chrome on iPad asking for the desktop site (a Mac user agent, MacIntel,
//    touch); Chrome, Edge and Firefox on iPhone (web views that answer "no" to rel=ar since iOS 16 and open Quick Look
//    themselves) all get Apple's AR view; Vision Pro gets its own sheet; Instagram, Facebook, a shop app's web view and
//    any web view that can't open it get "Open in Safari" (x-safari-https:) and Copy link, never a dead button.
// With "all" (or no ids) the browsers are tried on one product of each kind (floor, wall); with ids, on each.
// usage: node test_quicklook.mjs <base url> <out dir> [ids...|all]   (PORT: the browser's debugging port)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";
import { finishPath, finishSlug } from "../../site.js";
import { SITE } from "../../site-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const [base, outArg, ...idArgs] = process.argv.slice(2);
const out = path.resolve(outArg || path.join(root, ".work/test_quicklook"));
fs.mkdirSync(out, { recursive: true });
const PUBLIC = SITE.publicOrigin;
const catalogue = await (await fetch(`${base}/products.json`)).json();
const shown = catalogue.products.filter((p) => !p.hidden);
const all = !idArgs.length || idArgs.includes("all");
const products = all ? shown : idArgs.map((id) => catalogue.products.find((p) => p.id === id)).filter(Boolean);
if (!products.length) { console.error("no such products"); process.exit(2); }

let failed = 0, passed = 0;
const lines = [];
const log = (s) => { console.log(s); lines.push(s); };
const check = (ok, msg) => { log(`  ${ok ? "ok  " : "FAIL"} ${msg}`); if (ok) passed++; else failed++; return ok; };

const IOS = "18_5";
const UA = {
  iphone: `Mozilla/5.0 (iPhone; CPU iPhone OS ${IOS} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1`,
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15",
  chrome: `Mozilla/5.0 (iPhone; CPU iPhone OS ${IOS} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1`,
  edge: `Mozilla/5.0 (iPhone; CPU iPhone OS ${IOS} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.0.2903.48 Mobile/15E148 Safari/605.1.15`,
  firefox: `Mozilla/5.0 (iPhone; CPU iPhone OS ${IOS} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15`,
  instagram: `Mozilla/5.0 (iPhone; CPU iPhone OS ${IOS} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 Instagram 361.0.0.35.82 (iPhone15,3; iOS ${IOS}; en_IN; en-IN; scale=3.00; 1290x2796; 668374410)`,
  facebook: `Mozilla/5.0 (iPhone; CPU iPhone OS ${IOS} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22F76 [FBAN/FBIOS;FBAV/495.0.0.40.104;FBBV/672000000;FBDV/iPhone15,3;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBID/phone;FBLC/en_GB;FBOP/5]`,
  webview: `Mozilla/5.0 (iPhone; CPU iPhone OS ${IOS} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148`,
};
// what each Apple browser looks like to the page, and what it must get
const BROWSERS = [
  { name: "Safari on iPhone", ua: UA.iphone, platform: "iPhone", touch: 5, relAR: true, want: "ios" },
  { name: "Safari on iPad (desktop site)", ua: UA.mac, platform: "MacIntel", touch: 5, relAR: true, want: "ios", tablet: true },
  { name: "Chrome on iPhone", ua: UA.chrome, platform: "iPhone", touch: 5, relAR: false, handlers: true, want: "ios" },
  { name: "Chrome on iPad (desktop site)", ua: UA.mac, platform: "MacIntel", touch: 5, relAR: false, handlers: true, gcr: true, want: "ios", tablet: true },
  { name: "Edge on iPhone", ua: UA.edge, platform: "iPhone", touch: 5, relAR: false, handlers: true, want: "ios" },
  { name: "Firefox on iPhone", ua: UA.firefox, platform: "iPhone", touch: 5, relAR: false, handlers: true, ff: true, want: "ios" },
  { name: "Vision Pro (Safari)", ua: UA.mac, platform: "MacIntel", touch: 5, relAR: true, xrVR: true, want: "visionos", tablet: true },
  { name: "Instagram's browser", ua: UA.instagram, platform: "iPhone", touch: 5, relAR: false, handlers: true, want: "ios-inapp" },
  { name: "Facebook's browser", ua: UA.facebook, platform: "iPhone", touch: 5, relAR: false, handlers: true, want: "ios-inapp" },
  { name: "a shop app's web view (WKWebView)", ua: UA.webview, platform: "iPhone", touch: 5, relAR: false, handlers: true, want: "ios-inapp" },
  { name: "a web view with no script handlers", ua: UA.webview, platform: "iPhone", touch: 5, relAR: false, want: "ios-inapp" },
  { name: "Instagram's browser before iOS 16 (says yes to rel=ar)", ua: UA.instagram, platform: "iPhone", touch: 5, relAR: true, handlers: true, want: "ios-inapp" },
];
const fake = (c) => `(() => {
  const C = ${JSON.stringify(c)};
  const orig = DOMTokenList.prototype.supports;
  DOMTokenList.prototype.supports = function (t) { return t === "ar" ? C.relAR : orig.call(this, t); };
  if (C.handlers) window.webkit = { messageHandlers: {} };
  if (C.gcr) window.__gCrWeb = {};
  if (C.ff) window.__firefox__ = {};
  const xr = { isSessionSupported: async (m) => !!C.xrVR && m === "immersive-vr", requestSession: async () => { throw new Error("no headset in this test"); }, addEventListener() {}, removeEventListener() {} };
  try { Object.defineProperty(Navigator.prototype, "xr", { configurable: true, get: () => xr }); } catch {}
  window.__links = [];
  HTMLAnchorElement.prototype.click = function () { window.__links.push({ href: this.href, rel: this.rel, img: !!this.querySelector("img") }); };
  window.__tracked = [];
  Object.defineProperty(window, "s3dTrack", { configurable: true, get: () => (k, p, d) => window.__tracked.push([k, p, d]), set() {} });
})();`;

const b = await launch({ port: +(process.env.PORT || 9711), profile: path.join(out, "profile") });
await b.send("Network.enable");
// the 3D model and the studio light aren't needed to open AR; leaving them out keeps the run light
await b.send("Network.setBlockedURLs", { urls: ["*.glb", "*.glb?*", "*.hdr", "*.hdr?*"] });
let script = null;
async function as(br) {
  if (script) await b.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: script });
  script = (await b.send("Page.addScriptToEvaluateOnNewDocument", { source: fake(br) })).result.identifier;
  await b.send("Emulation.setUserAgentOverride", { userAgent: br.ua, platform: br.platform });
  await b.send("Emulation.setDeviceMetricsOverride", { width: br.tablet ? 820 : 390, height: br.tablet ? 1180 : 844, deviceScaleFactor: 2, mobile: !br.tablet });
  await b.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: br.touch });
}
const errors = () => b.logs.filter((l) => /EXCEPTION|\[error\]|^LOG /.test(l) && !/ERR_BLOCKED_BY_CLIENT|\.glb|\.hdr|blocked|Failed to fetch[^]*model-viewer/i.test(l));
let errSeen = 0;
async function open(url) {
  await b.go(url);
  return b.waitFor("!!window.__demo", 40000);
}
const linkFor = (p, i) => { const c = finishPath(p, i); return c ? encodeURI(c) : `/p/${p.id}${p.finishes.length > 1 ? `?finish=${finishSlug(p.finishes[i].name)}` : ""}`; };
const headCache = new Map();
async function served(file) {
  if (!headCache.has(file)) {
    const r = await fetch(`${base}${file}`, { headers: { Range: "bytes=0-3" } });
    const buf = Buffer.from(await r.arrayBuffer());
    headCache.set(file, { ok: r.ok, type: r.headers.get("content-type"), zip: buf.readUInt32LE(0) === 0x04034b50 });
  }
  return headCache.get(file);
}
// the banner Quick Look shows: on the public site at /banners/<id>; here, its file (made by make_banners.mjs)
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function bannerOk(p) {
  const f = path.join(root, "banners", `${p.id}.html`);
  if (!fs.existsSync(f)) return `banners/${p.id}.html is missing`;
  const h = fs.readFileSync(f, "utf8");
  const dims = `${parseFloat(p.size.w)} × ${parseFloat(p.size.h)} × ${parseFloat(p.size.d)} cm`;
  const want = [`<b>${esc(p.brand)} ${esc(p.shortName)}</b>`, `Real size, locked: ${esc(dims)}`, esc(p.arTip.split(" to ").slice(1).join(" to "))];
  const miss = want.filter((w) => !h.includes(w));
  if (miss.length) return `banners/${p.id}.html doesn't show ${miss.join(" / ")} (run make_banners.mjs)`;
  if (/<script|<a\s/i.test(h)) return `banners/${p.id}.html has a script or link (Quick Look shows HTML only)`;
  if (!fs.existsSync(path.join(root, "logos/sangeetha.png"))) return "logos/sangeetha.png (the banner's logo) is missing";
  return null;
}
// one caught Quick Look link, against what it must be for colour i
async function linkProblems(p, i, l, free) {
  const bad = [];
  if (!l) return ["no Quick Look link was opened"];
  if (l.rel !== "ar" || !l.img) bad.push(`rel="${l.rel}", ${l.img ? "" : "no "}img (Safari opens Quick Look only for rel=ar with one image)`);
  const u = new URL(l.href), h = new URLSearchParams(u.hash.slice(1));
  const want = free && p.placement !== "wall" ? p.finishes[i].usdz.replace(/\.usdz$/, "-free.usdz") : p.finishes[i].usdz;
  if (u.pathname !== want) bad.push(`opens ${u.pathname}, not ${want}`);
  const s = await served(u.pathname);
  if (!s.ok || s.type !== "model/vnd.usdz+zip" || !s.zip) bad.push(`${u.pathname}: ${s.ok ? `served as ${s.type}${s.zip ? "" : ", not a zip"}` : "not found"}`);
  if (u.searchParams.get("v") !== "7") bad.push(`cache key v=${u.searchParams.get("v")}`);
  if (h.get("allowsContentScaling") !== "0") bad.push("the size isn't locked (allowsContentScaling=0 missing)");
  if (h.get("custom") !== `${PUBLIC}/banners/${p.id}` || h.get("customHeight") !== "small") bad.push(`banner ${h.get("custom")} ${h.get("customHeight")}`);
  let c = null; try { c = new URL(h.get("canonicalWebPageURL")); } catch {}
  const page = linkFor(p, i).split("?")[0];
  if (!c || c.origin !== PUBLIC || c.pathname !== page) bad.push(`shares ${c?.href || "nothing"}, not ${PUBLIC}${page}`);
  else if ([...c.searchParams].length > 1) bad.push(`shares ${c.href}: Safari keeps only its first query parameter`);
  return bad;
}

const STORE = "ar-guide-skip";
const kinds = new Set();
const tryBrowsers = all ? products.filter((p) => { const k = `${p.placement || "floor"}`; if (kinds.has(k)) return false; kinds.add(k); return true; }) : products;

// ── 1. each Apple browser: the right sheet, and from it Apple's AR view or the way to Safari ──
for (const p of tryBrowsers) {
  log(`\n[${p.id}: the browsers]`);
  for (const br of BROWSERS) {
    await as(br);
    await open(`${base}${linkFor(p, 0)}`);
    await b.evalJS(`localStorage.removeItem(${JSON.stringify(STORE)})`);
    const got = await b.evalJS("window.__demo?.caps?.platform");
    await b.evalJS("document.getElementById('btnAR').click()");
    await sleep(350);
    const sheet = await b.evalJS("({ title: document.getElementById('sheetTitle')?.textContent, go: !!document.getElementById('sheetGo'), safari: !!document.getElementById('sheetSafari'), copy: !!document.getElementById('sheetCopy') })");
    if (br.want === "ios-inapp") {
      await b.evalJS("document.getElementById('sheetSafari')?.click()");
      await sleep(200);
      const l = await b.evalJS("window.__links.at(-1) || null");
      const tr = await b.evalJS("window.__tracked.filter((t) => t[0] === 'AR')");
      check(got === "ios-inapp" && sheet.safari && sheet.copy && !sheet.go && /^x-safari-https:\/\//.test(l?.href || "") && l.rel !== "ar" && !tr.length,
        `${br.name}: "${sheet.title}", Open in Safari (${l?.href?.slice(0, 60) || "nothing"}) and Copy link (platform ${got})`);
    } else {
      await b.evalJS("document.getElementById('sheetGo')?.click()");
      await sleep(250);
      const l = await b.evalJS("window.__links.at(-1) || null");
      const bad = await linkProblems(p, 0, l);
      const tr = await b.evalJS("JSON.stringify(window.__tracked.filter((t) => t[0] === 'AR'))");
      const wantTitle = br.want === "visionos" ? /Vision Pro/ : /real size/;
      check(got === br.want && sheet.go && wantTitle.test(sheet.title || "") && !bad.length && tr === JSON.stringify([["AR", p.id, br.want]]),
        `${br.name}: platform ${got}, "${sheet.title}", then Apple's AR view${bad.length ? `: ${bad.join("; ")}` : ""}${tr === JSON.stringify([["AR", p.id, br.want]]) ? "" : `; tracked ${tr}`}`);
    }
  }
  const e = errors();
  check(e.length === errSeen, `no console errors${e.length > errSeen ? `: ${e.slice(errSeen, errSeen + 3).join(" | ")}` : ""}`);
  errSeen = e.length;
}

// ── 2. every product, every colour, on Safari on iPhone ──
await as(BROWSERS[0]);
for (const p of products) {
  const n = p.finishes.length;
  log(`\n[${p.id}: ${n} colour${n > 1 ? "s" : ""}]`);
  const ban = bannerOk(p);
  check(!ban, ban || `banners/${p.id}.html names it and its size`);
  for (let i = 0; i < n; i++) {
    // the colour's own link, through the help sheet the first time, straight to AR once it is turned off
    await open(`${base}${linkFor(p, i)}`);
    await b.evalJS(`localStorage.removeItem(${JSON.stringify(STORE)})`);
    await b.evalJS("document.getElementById('btnAR').click()");
    await sleep(300);
    await b.evalJS("document.getElementById('sheetSkip') && (document.getElementById('sheetSkip').checked = true); document.getElementById('sheetGo')?.click()");
    await sleep(250);
    const viaSheet = await b.evalJS("window.__links.at(-1) || null");
    await sleep(350); // the sheet's closing animation
    await b.evalJS("document.getElementById('btnAR').click()");
    await sleep(250);
    const direct = await b.evalJS("window.__links.length === 2 ? window.__links[1] : null");
    const bad = [...await linkProblems(p, i, viaSheet), ...(await linkProblems(p, i, direct)).map((x) => `with the sheet off: ${x}`)];
    const shownIdx = await b.evalJS("[...document.querySelectorAll('#swatches .swatch')].findIndex((s) => s.getAttribute('aria-pressed') === 'true')");
    const tr = await b.evalJS("window.__tracked.filter((t) => t[0] === 'AR').length");
    check(!bad.length && (n < 2 || shownIdx === i) && tr === 2, `${linkFor(p, i)}: "${p.finishes[i].name}"${n > 1 ? ` (swatch ${shownIdx + 1} pressed)` : ""} opens ${p.finishes[i].usdz.split("/").pop()}${bad.length ? `: ${bad.join("; ")}` : ""}${tr === 2 ? "" : `; AR tracked ${tr} times, not 2`}`);
  }
  // picking each colour on the page, then AR
  if (n > 1) {
    await open(`${base}${linkFor(p, 0)}`);
    await b.evalJS(`localStorage.setItem(${JSON.stringify(STORE)}, "1")`);
    const bad = [];
    for (const i of [...Array(n).keys()].slice(1).concat(0)) {
      await b.evalJS(`window.__links = []; document.querySelectorAll('#swatches .swatch')[${i}].click()`);
      await sleep(120);
      await b.evalJS("document.getElementById('btnAR').click()");
      await sleep(150);
      const l = await b.evalJS("window.__links.at(-1) || null");
      const addr = await b.evalJS("location.pathname + location.search");
      const pb = await linkProblems(p, i, l);
      if (pb.length || addr !== linkFor(p, i)) bad.push(`"${p.finishes[i].name}": ${[...pb, ...(addr !== linkFor(p, i) ? [`address ${addr}`] : [])].join("; ")}`);
    }
    check(!bad.length, `picking each of the ${n} colours, then AR, opens that colour's file${bad.length ? `: ${bad.join(" | ")}` : ""}`);
  }
  // ?ql=free: the copy without the floor anchor (a wall unit has only the one file)
  await open(`${base}${linkFor(p, 0)}${linkFor(p, 0).includes("?") ? "&" : "?"}ql=free`);
  await b.evalJS(`localStorage.setItem(${JSON.stringify(STORE)}, "1"); window.__links = []`);
  await b.evalJS("document.getElementById('btnAR').click()");
  await sleep(200);
  const fl = await b.evalJS("window.__links.at(-1) || null");
  const fb = await linkProblems(p, 0, fl, true);
  check(!fb.length, `?ql=free opens ${p.placement === "wall" ? "the wall unit's one file" : "the -free copy"}${fb.length ? `: ${fb.join("; ")}` : ""}`);
  const e = errors();
  check(e.length === errSeen, `no console errors${e.length > errSeen ? `: ${e.slice(errSeen, errSeen + 3).join(" | ")}` : ""}`);
  errSeen = e.length;
}

log(`\n${passed} passed, ${failed} failed`);
fs.writeFileSync(path.join(out, "report.txt"), lines.join("\n") + "\n");
b.close();
process.exit(failed ? 1 : 0);
